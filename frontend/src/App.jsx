import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import AuthScreen from './AuthScreen';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip);

const apiBase = '/api';
const palette = ['#1b7a54', '#2e9d72', '#62bc93', '#a7ddc4', '#e2a13c', '#487fc5', '#db5858'];
const today = new Date().toISOString().slice(0, 10);

const money = (value) => value == null ? '-' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const number = (value, digits = 1) => value == null ? '-' : Number(value).toFixed(digits);
const chartData = (items, label) => ({
  labels: items.map((item) => item.nome),
  datasets: [{ label, data: items.map((item) => item.quantidade), backgroundColor: palette, borderRadius: 8 }],
});
const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };

async function request(path, options) {
  const token = localStorage.getItem('pecuaria.token');
  try {
    const headers = { ...(options?.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });
    const resData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem('pecuaria.token');
      localStorage.removeItem('pecuaria.fazenda');
      window.dispatchEvent(new Event('pecuaria:logout'));
    }
    if (!response.ok) throw new Error(resData.erro || resData.message || `Erro na requisição (${response.status})`);
    return resData;
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      throw new Error('Falha de conexão com o servidor. Verifique se o backend está em execução.');
    }
    throw error;
  }
}

function Metric({ label, value, detail, icon }) {
  return (
    <article className="metric-card">
      <div className="metric-head">
        <span className="metric-label">{label}</span>
        {icon && <span className="metric-icon">{icon}</span>}
      </div>
      <strong className="metric-value">{value}</strong>
      {detail && <span className="metric-detail">{detail}</span>}
    </article>
  );
}

function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`notice ${notice.type}`} role="status">
      <span>{notice.text}</span>
      <button onClick={onClose} aria-label="Fechar mensagem">×</button>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('pecuaria.token');
    const fazenda = localStorage.getItem('pecuaria.fazenda');
    return token && fazenda ? { token, fazenda: JSON.parse(fazenda) } : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lotes, setLotes] = useState([]);
  const [loteId, setLoteId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSexo, setFilterSexo] = useState('');
  const [quickModal, setQuickModal] = useState(null);

  // Formulários
  const [loteForm, setLoteForm] = useState({ nome: '', descricao: '' });
  const [animalForm, setAnimalForm] = useState({ id_brinco: '', raca: '', sexo: 'macho', data_nascimento: '', lote_id: '', data_entrada: today, condicao_reprodutiva: '', peso_kg: '', mae_id: '' });
  const [weightForm, setWeightForm] = useState({ animal_id: '', peso_kg: '', data_pesagem: today });
  const [transferForm, setTransferForm] = useState({ animal_id: '', lote_id: '' });
  const [vincularCriaForm, setVincularCriaForm] = useState({ mae_id: '', cria_id: '' });
  const [cotacaoForm, setCotacaoForm] = useState({ preco: '', categoria: 'Boi gordo' });
  const [syncingCotacao, setSyncingCotacao] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState('Hardware pronto para conexão.');
  const [hardwareBusy, setHardwareBusy] = useState(false);

  const animals = data?.animais || [];
  const distributions = data?.distribuicao || {};
  const selectedLote = useMemo(() => lotes.find((lote) => String(lote.id) === loteId), [lotes, loteId]);

  const loadLotes = async () => {
    const result = await request('/lotes');
    setLotes(result);
    setAnimalForm((current) => current.lote_id || !result.length ? current : { ...current, lote_id: String(result[0].id) });
    setTransferForm((current) => current.lote_id || !result.length ? current : { ...current, lote_id: String(result[0].id) });
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const filter = loteId ? `?lote_id=${loteId}` : '';
      const [herd, weighings] = await Promise.all([
        request(`/rebanho${filter}`),
        loteId ? request(`/pesagens/lote/${loteId}`) : Promise.resolve([]),
      ]);
      setData({ ...herd, pesagens_lote: weighings });
    } catch (error) {
      setData(null);
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth) return undefined;
    const updateOnline = () => setOnline(navigator.onLine);
    const logout = () => setAuth(null);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    window.addEventListener('pecuaria:logout', logout);
    loadLotes().catch((error) => setNotice({ type: 'error', text: error.message }));
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('pecuaria:logout', logout);
    };
  }, [auth]);

  useEffect(() => {
    if (auth) loadDashboard();
  }, [auth, loteId]);

  useEffect(() => {
    if (animals.length) {
      setWeightForm((current) => current.animal_id ? current : { ...current, animal_id: String(animals[0].id) });
      setTransferForm((current) => current.animal_id ? current : { ...current, animal_id: String(animals[0].id) });
      const vacas = animals.filter((a) => a.sexo === 'femea');
      const possiveisCrias = animals.filter((a) => (a.idade_meses == null || a.idade_meses <= 12) || a.categoria?.includes('Bezer'));
      if (vacas.length && !vincularCriaForm.mae_id) {
        setVincularCriaForm((c) => ({ ...c, mae_id: String(vacas[0].id) }));
      }
      if (possiveisCrias.length && !vincularCriaForm.cria_id) {
        setVincularCriaForm((c) => ({ ...c, cria_id: String(possiveisCrias[0].id) }));
      }
    }
  }, [data]);

  const refresh = async (message) => {
    await Promise.all([loadLotes(), loadDashboard()]);
    if (message) setNotice({ type: 'success', text: message });
  };

  const submitLote = async (event) => {
    event.preventDefault();
    try {
      const created = await request('/lotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loteForm) });
      setLoteForm({ nome: '', descricao: '' });
      setLoteId(String(created.id));
      setAnimalForm((current) => ({ ...current, lote_id: current.lote_id || String(created.id) }));
      setTransferForm((current) => ({ ...current, lote_id: current.lote_id || String(created.id) }));
      setQuickModal(null);
      await refresh('Lote cadastrado com sucesso.');
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const submitAnimal = async (event) => {
    event.preventDefault();
    if (!animalForm.lote_id || Number(animalForm.lote_id) <= 0) {
      setNotice({ type: 'error', text: 'Cadastre e selecione um lote antes de adicionar um animal.' });
      return;
    }
    try {
      const payload = {
        ...animalForm,
        lote_id: Number(animalForm.lote_id),
        mae_id: animalForm.mae_id ? Number(animalForm.mae_id) : undefined,
        condicao_reprodutiva: animalForm.condicao_reprodutiva || null,
        peso_kg: animalForm.peso_kg ? Number(animalForm.peso_kg) : undefined,
      };
      await request('/animais', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setAnimalForm({ id_brinco: '', raca: '', sexo: 'macho', data_nascimento: '', lote_id: animalForm.lote_id, data_entrada: today, condicao_reprodutiva: '', peso_kg: '', mae_id: '' });
      setLoteId(String(payload.lote_id));
      setQuickModal(null);
      await refresh('Animal cadastrado com sucesso.');
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const submitWeight = async (event) => {
    event.preventDefault();
    try {
      await request('/pesagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...weightForm, animal_id: Number(weightForm.animal_id), peso_kg: Number(weightForm.peso_kg), origem: 'manual' }) });
      setWeightForm((current) => ({ ...current, peso_kg: '' }));
      setQuickModal(null);
      await refresh('Pesagem manual registrada.');
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const submitTransfer = async (event) => {
    event.preventDefault();
    try {
      await request(`/animais/${transferForm.animal_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lote_id: Number(transferForm.lote_id) }) });
      setQuickModal(null);
      await refresh('Animal transferido para o novo lote.');
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const submitVincularCria = async (event) => {
    event.preventDefault();
    if (!vincularCriaForm.mae_id || !vincularCriaForm.cria_id) {
      setNotice({ type: 'error', text: 'Selecione a vaca e o bezerro(a) para vincular.' });
      return;
    }
    try {
      await request(`/animais/${vincularCriaForm.mae_id}/vincular-cria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cria_id: Number(vincularCriaForm.cria_id) }),
      });
      setQuickModal(null);
      await refresh('Cria vinculada com sucesso à vaca (condição atualizada para Cria ao pé).');
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const syncMarketPrice = async () => {
    setSyncingCotacao(true);
    try {
      const result = await request('/cotacao/sincronizar', { method: 'POST' });
      await refresh(`Cotação CEPEA sincronizada ao vivo: ${money(result.preco)} (@)`);
    } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setSyncingCotacao(false); }
  };

  const submitCotacao = async (event) => {
    event.preventDefault();
    try {
      await request('/cotacao/arroba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preco: Number(cotacaoForm.preco), categoria: cotacaoForm.categoria }),
      });
      setCotacaoForm((c) => ({ ...c, preco: '' }));
      await refresh(`Cotação manual para ${cotacaoForm.categoria} cadastrada com sucesso.`);
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const configureHardware = async () => {
    setHardwareBusy(true);
    setHardwareStatus('Configurando câmera, OCR e Arduino...');
    try {
      await request('/pesagens/camera/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setHardwareStatus('Hardware configurado e pronto para pesagem.');
    } catch (error) { setHardwareStatus(error.message); } finally { setHardwareBusy(false); }
  };

  const autoWeigh = async () => {
    setHardwareBusy(true);
    setHardwareStatus('Capturando brinco e aguardando peso estável...');
    try {
      const result = await request('/pesagens/camera', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setHardwareStatus(`Pesagem registrada: ${result.animal.id_brinco}, ${result.pesagem.peso_kg} kg.`);
      await refresh();
    } catch (error) { setHardwareStatus(error.message); } finally { setHardwareBusy(false); }
  };

  const totalWeight = animals.filter((animal) => animal.peso_atual_kg != null).reduce((sum, animal) => sum + Number(animal.peso_atual_kg), 0);
  const weighed = animals.filter((animal) => animal.peso_atual_kg != null);
  const totalValue = animals.reduce((sum, animal) => sum + Number(animal.valor_estimado || 0), 0);
  const performance = aggregateWeings(data?.pesagens_lote || []);

  const filteredAnimals = useMemo(() => {
    return animals.filter((a) => {
      const matchSearch = !searchTerm || a.id_brinco.toLowerCase().includes(searchTerm.toLowerCase()) || a.raca.toLowerCase().includes(searchTerm.toLowerCase()) || (a.categoria && a.categoria.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchSexo = !filterSexo || a.sexo === filterSexo;
      return matchSearch && matchSexo;
    });
  }, [animals, searchTerm, filterSexo]);

  const authenticated = (result) => {
    localStorage.setItem('pecuaria.token', result.token);
    localStorage.setItem('pecuaria.fazenda', JSON.stringify(result.fazenda));
    setAuth(result);
  };

  const logout = async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('pecuaria.token');
      localStorage.removeItem('pecuaria.fazenda');
      setAuth(null);
    }
  };

  if (!auth) return <AuthScreen onAuthenticated={authenticated} />;

  const vacasDisponiveis = animals.filter((a) => a.sexo === 'femea');
  const bezerradaDisponivel = animals.filter((a) => a.idade_meses == null || a.idade_meses <= 12 || a.categoria?.includes('Bezer'));

  return (
    <div className="app-shell">
      {/* Topbar moderna */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">🐂</div>
          <div>
            <strong>Pecuária Smart</strong>
            <small>{auth.fazenda.nome}</small>
          </div>
        </div>

        {/* Abas Principais de Navegação */}
        <nav className="nav-tabs" aria-label="Navegação do sistema">
          <button className={activeTab === 'dashboard' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('dashboard')}>
            📊 Painel & Gráficos
          </button>
          <button className={activeTab === 'animais' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('animais')}>
            📋 Rebanho ({animals.length})
          </button>
          <button className={activeTab === 'operacoes' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('operacoes')}>
            ⚡ Manejo & Lotes
          </button>
          <button className={activeTab === 'cotacoes' ? 'tab-btn active' : 'tab-btn'} onClick={() => setActiveTab('cotacoes')}>
            💰 Cotações de Mercado
          </button>
        </nav>

        <div className="topbar-actions">
          <span className={`connection-badge ${online ? 'online' : 'offline'}`}>
            <span className="dot"></span> {online ? 'Conectado' : 'Offline'}
          </span>
          <button className="btn-logout" onClick={logout} title="Sair da conta">Sair</button>
        </div>
      </header>

      {/* Barra de Ações Rápidas */}
      <section className="quick-actions-bar">
        <div className="quick-left">
          <div className="lote-selector-pill">
            <span>📍 Lote:</span>
            <select value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              <option value="">Todos os lotes ({lotes.length})</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>{lote.nome}</option>
              ))}
            </select>
          </div>
          <button className="btn-refresh" disabled={loading} onClick={() => refresh()}>
            {loading ? '🔄 Atualizando...' : '🔄 Atualizar'}
          </button>
        </div>

        <div className="quick-right">
          <button className="btn-quick primary" onClick={() => setQuickModal('animal')}>
            ➕ Novo Animal
          </button>
          <button className="btn-quick" onClick={() => setQuickModal('pesagem')}>
            ⚖️ Nova Pesagem
          </button>
          <button className="btn-quick special" onClick={() => setQuickModal('vincular')}>
            🍼 Vincular Cria
          </button>
          <button className="btn-quick" onClick={() => setQuickModal('lote')}>
            📁 Novo Lote
          </button>
        </div>
      </section>

      <main className="main-content">
        <Notice notice={notice} onClose={() => setNotice(null)} />

        {/* Modal de Ação Rápida */}
        {quickModal && (
          <div className="modal-overlay" onClick={() => setQuickModal(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>
                  {quickModal === 'animal' && '➕ Cadastrar Novo Animal'}
                  {quickModal === 'pesagem' && '⚖️ Registrar Pesagem'}
                  {quickModal === 'vincular' && '🍼 Vincular Vaca e Cria ao Pé'}
                  {quickModal === 'lote' && '📁 Criar Novo Lote'}
                </h3>
                <button className="btn-close" onClick={() => setQuickModal(null)}>×</button>
              </div>

              <div className="modal-body">
                {quickModal === 'animal' && (
                  <form onSubmit={submitAnimal}>
                    <div className="form-grid">
                      <Field label="Número do Brinco"><input required autoFocus value={animalForm.id_brinco} onChange={(e) => setAnimalForm({ ...animalForm, id_brinco: e.target.value })} placeholder="Ex: BR-104" /></Field>
                      <Field label="Raça"><input required value={animalForm.raca} onChange={(e) => setAnimalForm({ ...animalForm, raca: e.target.value })} placeholder="Ex: Nelore, Angus" /></Field>
                      <Field label="Sexo">
                        <select value={animalForm.sexo} onChange={(e) => setAnimalForm({ ...animalForm, sexo: e.target.value })}>
                          <option value="macho">Macho</option>
                          <option value="femea">Fêmea</option>
                        </select>
                      </Field>
                      <Field label="Lote de Destino">
                        <select required value={animalForm.lote_id} onChange={(e) => setAnimalForm({ ...animalForm, lote_id: e.target.value })}>
                          {lotes.length === 0 ? <option value="">Cadastre um lote primeiro</option> : lotes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                        </select>
                      </Field>
                      <Field label="Data de Nascimento"><input required type="date" value={animalForm.data_nascimento} onChange={(e) => setAnimalForm({ ...animalForm, data_nascimento: e.target.value })} /></Field>
                      <Field label="Data de Entrada"><input required type="date" value={animalForm.data_entrada} onChange={(e) => setAnimalForm({ ...animalForm, data_entrada: e.target.value })} /></Field>
                      <Field label="Condição Reprodutiva">
                        <select value={animalForm.condicao_reprodutiva} onChange={(e) => setAnimalForm({ ...animalForm, condicao_reprodutiva: e.target.value })}>
                          <option value="">Não informar</option>
                          <option value="inteiro">Inteiro</option>
                          <option value="castrado">Castrado</option>
                          <option value="vazia">Vazia</option>
                          <option value="prenha">Prenha</option>
                          <option value="com_cria_ao_pe">Com cria ao pé</option>
                        </select>
                      </Field>
                      <Field label="Vaca Mãe (se for bezerro/cria)">
                        <select value={animalForm.mae_id} onChange={(e) => setAnimalForm({ ...animalForm, mae_id: e.target.value })}>
                          <option value="">Nenhuma / Sem mãe vinculada</option>
                          {vacasDisponiveis.map((v) => <option key={v.id} value={v.id}>{v.id_brinco} · {v.raca}</option>)}
                        </select>
                      </Field>
                      <Field label="Peso Inicial (kg)" hint="Opcional">
                        <input type="number" min="30" max="2000" step="0.1" value={animalForm.peso_kg} onChange={(e) => setAnimalForm({ ...animalForm, peso_kg: e.target.value })} placeholder="Ex: 180.5" />
                      </Field>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn-secondary" onClick={() => setQuickModal(null)}>Cancelar</button>
                      <button type="submit" className="btn-primary">Salvar Animal</button>
                    </div>
                  </form>
                )}

                {quickModal === 'pesagem' && (
                  <form onSubmit={submitWeight}>
                    <div className="form-grid">
                      <Field label="Selecione o Animal">
                        <select required value={weightForm.animal_id} onChange={(e) => setWeightForm({ ...weightForm, animal_id: e.target.value })}>
                          {animals.length === 0 ? <option value="">Nenhum animal cadastrado</option> : animals.map((a) => <option key={a.id} value={a.id}>{a.id_brinco} · {a.raca} ({a.sexo})</option>)}
                        </select>
                      </Field>
                      <Field label="Peso Atual (kg)">
                        <input required autoFocus type="number" min="1" step="0.1" value={weightForm.peso_kg} onChange={(e) => setWeightForm({ ...weightForm, peso_kg: e.target.value })} placeholder="Ex: 485.5" />
                      </Field>
                      <Field label="Data da Pesagem">
                        <input required type="date" value={weightForm.data_pesagem} onChange={(e) => setWeightForm({ ...weightForm, data_pesagem: e.target.value })} />
                      </Field>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn-secondary" onClick={() => setQuickModal(null)}>Cancelar</button>
                      <button type="submit" className="btn-primary">Gravar Pesagem</button>
                    </div>
                  </form>
                )}

                {quickModal === 'vincular' && (
                  <form onSubmit={submitVincularCria}>
                    <p className="modal-desc">Associe uma matriz (vaca) com seu bezerro ou bezerra no lote para rastreamento de cria ao pé e valorização zootécnica.</p>
                    <div className="form-grid">
                      <Field label="Vaca (Matriz)">
                        <select required value={vincularCriaForm.mae_id} onChange={(e) => setVincularCriaForm({ ...vincularCriaForm, mae_id: e.target.value })}>
                          {vacasDisponiveis.length === 0 ? <option value="">Nenhuma fêmea cadastrada</option> : vacasDisponiveis.map((v) => <option key={v.id} value={v.id}>{v.id_brinco} · {v.raca}</option>)}
                        </select>
                      </Field>
                      <Field label="Bezerro / Bezerra (Cria)">
                        <select required value={vincularCriaForm.cria_id} onChange={(e) => setVincularCriaForm({ ...vincularCriaForm, cria_id: e.target.value })}>
                          {bezerradaDisponivel.length === 0 ? <option value="">Nenhum bezerro disponível</option> : bezerradaDisponivel.map((c) => <option key={c.id} value={c.id}>{c.id_brinco} · {c.raca} ({c.sexo})</option>)}
                        </select>
                      </Field>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn-secondary" onClick={() => setQuickModal(null)}>Cancelar</button>
                      <button type="submit" className="btn-primary special">Vincular Par Mãe-Cria</button>
                    </div>
                  </form>
                )}

                {quickModal === 'lote' && (
                  <form onSubmit={submitLote}>
                    <div className="form-grid">
                      <Field label="Nome do Lote"><input required autoFocus value={loteForm.nome} onChange={(e) => setLoteForm({ ...loteForm, nome: e.target.value })} placeholder="Ex: Confinamento Piquete 1" /></Field>
                      <Field label="Descrição ou Objetivo"><input value={loteForm.descricao} onChange={(e) => setLoteForm({ ...loteForm, descricao: e.target.value })} placeholder="Ex: Machos Nelore em engorda intensiva" /></Field>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn-secondary" onClick={() => setQuickModal(null)}>Cancelar</button>
                      <button type="submit" className="btn-primary">Criar Lote</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ABA 1: PAINEL & INDICADORES GERAIS */}
        {/* ============================================================ */}
        {activeTab === 'dashboard' && (
          <div className="tab-content">
            {/* Linha de KPIs Principais */}
            <section className="metrics-grid">
              <Metric label="Rebanho Monitorado" value={data?.total ?? '0'} detail={selectedLote ? `Lote ${selectedLote.nome}` : 'Todos os lotes'} icon="🐂" />
              <Metric label="Peso Médio Atual" value={`${number(weighed.length ? totalWeight / weighed.length : 0)} kg`} detail={`${weighed.length} animais com peso recente`} icon="⚖️" />
              <Metric label="Patrimônio Estimado Total" value={money(totalValue)} detail="Calculado por categoria e cotação viva" icon="💵" />
              <Metric label="Boi Gordo CEPEA (@)" value={money(data?.cotacao?.preco)} detail={data?.cotacao?.fonte || 'Referência CEPEA/SP'} icon="📈" />
            </section>

            {/* Painel de Cotações Rápidas por Categoria */}
            {data?.cotacao?.categorias && (
              <section className="panel live-market-panel">
                <div className="panel-header">
                  <div>
                    <span className="tag-pill green">Mercado ao Vivo</span>
                    <h3>Cotações por Categoria (@)</h3>
                  </div>
                  <button className="btn-mini" onClick={syncMarketPrice} disabled={syncingCotacao}>
                    {syncingCotacao ? 'Atualizando...' : '🔄 Sincronizar Mercado'}
                  </button>
                </div>
                <div className="live-market-grid">
                  {Object.entries(data.cotacao.categorias).map(([catNome, catInfo]) => (
                    <div className="market-card" key={catNome}>
                      <span className="market-cat-title">{catNome}</span>
                      <strong className="market-cat-price">{money(catInfo.preco)}</strong>
                      <small className="market-cat-source" title={catInfo.fonte}>{catInfo.fonte}</small>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Gráficos Interativos */}
            <section className="charts-grid">
              <div className="panel chart-card">
                <h3>Distribuição por Raça</h3>
                <div className="chart-wrapper">
                  <Bar data={chartData(distributions.raca || [], 'Quantidade')} options={{ ...chartOptions, plugins: { legend: { display: false } } }} />
                </div>
              </div>

              <div className="panel chart-card">
                <h3>Classificação Zootécnica</h3>
                <div className="chart-wrapper">
                  <Doughnut data={chartData(distributions.categoria || [], 'Animais')} options={chartOptions} />
                </div>
              </div>

              <div className="panel chart-card full-width">
                <h3>Evolução de Ganho de Peso Médio no Lote (GMD)</h3>
                <div className="chart-wrapper wide">
                  {performance.length ? (
                    <Line
                      data={{
                        labels: performance.map((i) => i.periodo),
                        datasets: [{
                          label: 'Peso Médio (kg)',
                          data: performance.map((i) => i.valor),
                          borderColor: '#1b7a54',
                          backgroundColor: 'rgba(27, 122, 84, 0.12)',
                          fill: true,
                          tension: 0.35,
                        }],
                      }}
                      options={chartOptions}
                    />
                  ) : (
                    <div className="empty-chart-msg">
                      <p>Registre pesagens ao longo do tempo para visualizar a curva de desempenho.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ============================================================ */}
        {/* ABA 2: LISTAGEM E TABELA DO REBANHO */}
        {/* ============================================================ */}
        {activeTab === 'animais' && (
          <div className="tab-content">
            <section className="panel table-container">
              <div className="table-top-bar">
                <div className="table-search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar por brinco, raça ou categoria..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}
                </div>

                <div className="table-filter-group">
                  <select value={filterSexo} onChange={(e) => setFilterSexo(e.target.value)}>
                    <option value="">Todos os sexos</option>
                    <option value="macho">Machos</option>
                    <option value="femea">Fêmeas</option>
                  </select>

                  <button className="btn-primary" onClick={() => setQuickModal('animal')}>
                    ➕ Cadastrar Animal
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Brinco</th>
                      <th>Raça</th>
                      <th>Sexo</th>
                      <th>Idade</th>
                      <th>Categoria Zootécnica</th>
                      <th>Peso Atual</th>
                      <th>Família / Vínculo</th>
                      <th>Cotação Aplicada</th>
                      <th>Valor Estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnimals.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="empty-table">
                          <p>Nenhum animal encontrado para os filtros selecionados.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredAnimals.map((animal) => (
                        <tr key={animal.id}>
                          <td><strong className="brinco-badge">{animal.id_brinco}</strong></td>
                          <td>{animal.raca}</td>
                          <td>
                            <span className={`sex-badge ${animal.sexo}`}>
                              {animal.sexo === 'macho' ? '♂ Macho' : '♀ Fêmea'}
                            </span>
                          </td>
                          <td>{animal.idade_meses ?? '—'} m</td>
                          <td><span className="cat-badge">{animal.categoria || 'Não classificado'}</span></td>
                          <td><strong>{animal.peso_atual_kg != null ? `${number(animal.peso_atual_kg)} kg` : '—'}</strong></td>
                          <td>
                            {animal.cria_ao_pe ? (
                              <span className="badge-link cria" title={`Bezerro(a) ID: ${animal.cria_ao_pe.id_brinco}`}>
                                🍼 Cria: {animal.cria_ao_pe.id_brinco}
                              </span>
                            ) : animal.mae_brinco ? (
                              <span className="badge-link mae" title={`Vaca Mãe ID: ${animal.mae_brinco}`}>
                                🐮 Mãe: {animal.mae_brinco}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>{money(animal.preco_arroba_aplicado)} /@</td>
                          <td><strong className="price-value">{money(animal.valor_estimado)}</strong></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ============================================================ */}
        {/* ABA 3: MANEJO & OPERAÇÕES */}
        {/* ============================================================ */}
        {activeTab === 'operacoes' && (
          <div className="tab-content">
            <div className="operations-grid">
              {/* Card 1: Vincular Matriz e Bezerro */}
              <div className="panel op-card highlighted">
                <div className="card-head">
                  <span className="card-icon">🍼</span>
                  <div>
                    <h3>Vínculo de Cria ao Pé</h3>
                    <p>Associe vacas com bezerros para controle de lactação e desmame.</p>
                  </div>
                </div>
                <form onSubmit={submitVincularCria}>
                  <Field label="Vaca (Matriz)">
                    <select required value={vincularCriaForm.mae_id} onChange={(e) => setVincularCriaForm({ ...vincularCriaForm, mae_id: e.target.value })}>
                      {vacasDisponiveis.length === 0 ? <option value="">Nenhuma vaca no lote</option> : vacasDisponiveis.map((v) => <option key={v.id} value={v.id}>{v.id_brinco} · {v.raca}</option>)}
                    </select>
                  </Field>
                  <Field label="Bezerro / Cria">
                    <select required value={vincularCriaForm.cria_id} onChange={(e) => setVincularCriaForm({ ...vincularCriaForm, cria_id: e.target.value })}>
                      {bezerradaDisponivel.length === 0 ? <option value="">Nenhuma cria no lote</option> : bezerradaDisponivel.map((c) => <option key={c.id} value={c.id}>{c.id_brinco} · {c.raca} ({c.sexo})</option>)}
                    </select>
                  </Field>
                  <button className="btn-primary full special">Vincular Par Mãe-Cria</button>
                </form>
              </div>

              {/* Card 2: Transferência entre Lotes */}
              <div className="panel op-card">
                <div className="card-head">
                  <span className="card-icon">🚚</span>
                  <div>
                    <h3>Transferência de Lote</h3>
                    <p>Mova animais entre piquetes ou fases de confinamento.</p>
                  </div>
                </div>
                <form onSubmit={submitTransfer}>
                  <Field label="Animal a Transferir">
                    <select required value={transferForm.animal_id} onChange={(e) => setTransferForm({ ...transferForm, animal_id: e.target.value })}>
                      {animals.length === 0 ? <option value="">Nenhum animal disponível</option> : animals.map((a) => <option key={a.id} value={a.id}>{a.id_brinco} · {a.raca}</option>)}
                    </select>
                  </Field>
                  <Field label="Lote de Destino">
                    <select required value={transferForm.lote_id} onChange={(e) => setTransferForm({ ...transferForm, lote_id: e.target.value })}>
                      {lotes.length === 0 ? <option value="">Nenhum lote cadastrado</option> : lotes.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                    </select>
                  </Field>
                  <button className="btn-secondary full">Transferir Animal</button>
                </form>
              </div>

              {/* Card 3: Pesagem Automática / IoT */}
              <div className="panel op-card">
                <div className="card-head">
                  <span className="card-icon">📷</span>
                  <div>
                    <h3>Pesagem com Câmera e Balança</h3>
                    <p>Integração automática com câmera OCR e balança eletrônica.</p>
                  </div>
                </div>
                <div className="hardware-box">
                  <p className="status-text">{hardwareStatus}</p>
                </div>
                <div className="btn-row">
                  <button className="btn-secondary" disabled={hardwareBusy} onClick={configureHardware}>Configurar</button>
                  <button className="btn-primary" disabled={hardwareBusy} onClick={autoWeigh}>
                    {hardwareBusy ? 'Processando...' : 'Pesagem com Câmera'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ABA 4: COTAÇÕES E MERCADO */}
        {/* ============================================================ */}
        {activeTab === 'cotacoes' && (
          <div className="tab-content">
            <div className="cotacoes-layout">
              <div className="panel cotacao-overview-card">
                <div className="card-head">
                  <span className="card-icon">💹</span>
                  <div>
                    <h3>Mercado e Precificação da Arroba</h3>
                    <p>Sincronize com os principais indicadores ou ajuste preços locais para sua fazenda.</p>
                  </div>
                </div>

                <div className="sync-banner">
                  <div>
                    <strong>Referência Atual: {data?.cotacao?.fonte || 'CEPEA/Esalq'}</strong>
                    <p>Boi Gordo padrão: <span>{data?.cotacao?.preco ? money(data.cotacao.preco) : '—'}</span></p>
                  </div>
                  <button className="btn-primary" disabled={syncingCotacao} onClick={syncMarketPrice}>
                    {syncingCotacao ? 'Buscando cotações...' : '🔄 Sincronizar Mercado Agora'}
                  </button>
                </div>

                <div className="cotacoes-cards-full">
                  {data?.cotacao?.categorias && Object.entries(data.cotacao.categorias).map(([catNome, catInfo]) => (
                    <div className="cat-price-row" key={catNome}>
                      <div className="cat-price-info">
                        <strong>{catNome}</strong>
                        <small>{catInfo.fonte}</small>
                      </div>
                      <div className="cat-price-val">
                        <span>{money(catInfo.preco)}</span>
                        <small>/ arroba (@)</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel cotacao-form-card">
                <h3>Definir Cotação Manual</h3>
                <p>Personalize o valor da arroba para uma categoria específica praticada na sua região.</p>
                <form onSubmit={submitCotacao}>
                  <Field label="Categoria de Gado">
                    <select value={cotacaoForm.categoria} onChange={(e) => setCotacaoForm({ ...cotacaoForm, categoria: e.target.value })}>
                      <option value="Boi gordo">Boi gordo</option>
                      <option value="Vaca gorda">Vaca gorda</option>
                      <option value="Vaca">Vaca</option>
                      <option value="Novilha">Novilha</option>
                      <option value="Novilho">Novilho</option>
                      <option value="Bezerro">Bezerro</option>
                      <option value="Bezerra">Bezerra</option>
                      <option value="Garrote">Garrote</option>
                      <option value="Touro">Touro</option>
                    </select>
                  </Field>
                  <Field label="Preço da Arroba (R$/@)">
                    <input required type="number" min="1" step="0.01" value={cotacaoForm.preco} onChange={(e) => setCotacaoForm({ ...cotacaoForm, preco: e.target.value })} placeholder="Ex: 340.00" />
                  </Field>
                  <button className="btn-primary full">Salvar Cotação da Categoria</button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function aggregateWeings(weighings) {
  const periods = new Map();
  for (const weighing of weighings) {
    const date = new Date(weighing.data_pesagem);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = periods.get(period) || { total: 0, count: 0 };
    periods.set(period, { total: current.total + Number(weighing.peso_kg), count: current.count + 1 });
  }
  return [...periods.entries()]
    .map(([periodo, value]) => ({ periodo, valor: Math.round((value.total / value.count) * 100) / 100 }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
}
