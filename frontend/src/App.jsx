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
const palette = ['#176b4d', '#32936f', '#7abf9d', '#bedfca', '#e6a84a', '#5a82c8', '#d8665e'];
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
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { ...(options?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem('pecuaria.token');
      localStorage.removeItem('pecuaria.fazenda');
      window.dispatchEvent(new Event('pecuaria:logout'));
    }
    if (!response.ok) throw new Error(data.erro || data.message || `Erro na requisição (${response.status})`);
    return data;
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      throw new Error('Falha de conexão com o servidor. Verifique se o backend está em execução.');
    }
    throw error;
  }
}

function Metric({ label, value, detail }) {
  return <article className="metric"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function Notice({ notice, onClose }) {
  if (!notice) return null;
  return <div className={`notice ${notice.type}`} role="status">{notice.text}<button onClick={onClose} aria-label="Fechar mensagem">×</button></div>;
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('pecuaria.token');
    const fazenda = localStorage.getItem('pecuaria.fazenda');
    return token && fazenda ? { token, fazenda: JSON.parse(fazenda) } : null;
  });
  const [view, setView] = useState('home');
  const [lotes, setLotes] = useState([]);
  const [loteId, setLoteId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [loteForm, setLoteForm] = useState({ nome: '', descricao: '' });
  const [animalForm, setAnimalForm] = useState({ id_brinco: '', raca: '', sexo: 'macho', data_nascimento: '', lote_id: '', data_entrada: today, condicao_reprodutiva: '', peso_kg: '', mae_id: '' });
  const [weightForm, setWeightForm] = useState({ animal_id: '', peso_kg: '', data_pesagem: today });
  const [transferForm, setTransferForm] = useState({ animal_id: '', lote_id: '' });
  const [vincularCriaForm, setVincularCriaForm] = useState({ mae_id: '', cria_id: '' });
  const [cotacaoForm, setCotacaoForm] = useState({ preco: '', categoria: 'Boi gordo' });
  const [syncingCotacao, setSyncingCotacao] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState('Hardware não configurado.');
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
    if (auth && view === 'dashboard') loadDashboard();
  }, [auth, view, loteId]);

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
      await refresh('Animal cadastrado com sucesso.');
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const submitWeight = async (event) => {
    event.preventDefault();
    try {
      await request('/pesagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...weightForm, animal_id: Number(weightForm.animal_id), peso_kg: Number(weightForm.peso_kg), origem: 'manual' }) });
      setWeightForm((current) => ({ ...current, peso_kg: '' }));
      await refresh('Pesagem manual registrada.');
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const submitTransfer = async (event) => {
    event.preventDefault();
    try {
      await request(`/animais/${transferForm.animal_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lote_id: Number(transferForm.lote_id) }) });
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
  const performance = aggregateWeighings(data?.pesagens_lote || []);

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">PS</span><div><strong>Pecuária Smart</strong><small>{auth.fazenda.nome}</small></div></div>
        <nav aria-label="Navegação principal">
          <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Início</button>
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Painel</button>
        </nav>
        <span className={`connection ${online ? '' : 'offline'}`}>{online ? 'Online' : 'Modo offline'}</span><button className="logout" onClick={logout}>Sair</button>
      </header>

      <main>
        <Notice notice={notice} onClose={() => setNotice(null)} />
        {view === 'home' ? (
          <section className="hero">
            <div className="hero-content"><span className="eyebrow">GESTÃO INTELIGENTE</span><h1>Decisões mais claras para o seu rebanho.</h1><p>Controle lotes, pesagens e valor estimado em uma experiência pensada para o campo, no computador ou no celular.</p><div className="actions"><button className="primary" onClick={() => setView('dashboard')}>Abrir painel</button><a href="#recursos">Conhecer recursos</a></div></div>
            <div className="hero-summary"><p>Visão operacional</p><strong>{data?.total ?? '—'} <small>animais monitorados</small></strong><div><span>Pesagens</span><b>Atualizadas em tempo real</b></div><div><span>Instalação</span><b>Disponível como aplicativo</b></div></div>
          </section>
        ) : (
          <>
            <section className="dashboard-heading"><div><span className="eyebrow">PAINEL OPERACIONAL</span><h1>{selectedLote ? selectedLote.nome : 'Visão do rebanho'}</h1><p>Indicadores atualizados para orientar o manejo diário.</p></div><button className="primary" disabled={loading} onClick={() => refresh()}>{loading ? 'Atualizando...' : 'Atualizar dados'}</button></section>
            <section className="filters panel"><Field label="Visualizar lote"><select value={loteId} onChange={(event) => setLoteId(event.target.value)}><option value="">Todos os lotes</option>{lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select></Field><p>Filtre o painel para comparar desempenho, composição e valor de cada lote.</p></section>
            {loading ? <div className="loading">Atualizando os indicadores...</div> : !data || !animals.length ? <div className="empty"><h2>Nenhum animal encontrado</h2><p>Cadastre um lote e seus animais para começar a acompanhar o rebanho.</p></div> : <Dashboard metrics={{ totalWeight, weighed, totalValue, animals, data }} distributions={distributions} performance={performance} />}
            <Operations lotes={lotes} animals={animals} loteForm={loteForm} setLoteForm={setLoteForm} animalForm={animalForm} setAnimalForm={setAnimalForm} weightForm={weightForm} setWeightForm={setWeightForm} transferForm={transferForm} setTransferForm={setTransferForm} submitLote={submitLote} submitAnimal={submitAnimal} submitWeight={submitWeight} submitTransfer={submitTransfer} hardwareStatus={hardwareStatus} hardwareBusy={hardwareBusy} configureHardware={configureHardware} autoWeigh={autoWeigh} cotacaoForm={cotacaoForm} setCotacaoForm={setCotacaoForm} submitCotacao={submitCotacao} syncMarketPrice={syncMarketPrice} syncingCotacao={syncingCotacao} currentCotacao={data?.cotacao} />
          </>
        )}
        {view === 'home' && <section id="recursos" className="features"><article><span>01</span><h2>Painel de decisão</h2><p>Visualize peso médio, valor estimado, cotação e classificação em um só lugar.</p></article><article><span>02</span><h2>Rotina simplificada</h2><p>Cadastre lotes, animais e pesagens sem planilhas paralelas.</p></article><article><span>03</span><h2>Pronto para o campo</h2><p>Instale o sistema no dispositivo e acesse a interface mesmo sem conexão.</p></article></section>}
      </main>
    </div>
  );
}

function aggregateWeighings(weighings) {
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

function Dashboard({ metrics, distributions, performance }) {
  const { totalWeight, weighed, totalValue, animals, data } = metrics;
  const sexTotal = (distributions.sexo || []).reduce((sum, item) => sum + Number(item.quantidade), 0);
  const trend = performance.map((item) => ({ x: item.periodo, y: item.valor }));
  const cotacoesCategorias = data.cotacao?.categorias ? Object.entries(data.cotacao.categorias) : [];

  return <div className="dashboard">
    <section className="metrics">
      <Metric label="Animais no filtro" value={data.total} detail="Registros ativos" />
      <Metric label="Peso médio" value={`${number(weighed.length ? totalWeight / weighed.length : 0)} kg`} detail={`${weighed.length} com peso atualizado`} />
      <Metric label="Valor estimado total" value={money(totalValue)} detail="Calculado por categoria" />
      <Metric label="Boi Gordo (Ref. CEPEA)" value={money(data.cotacao?.preco)} detail={data.cotacao?.fonte || 'Sem fonte'} />
    </section>

    {cotacoesCategorias.length > 0 && (
      <section className="panel cotacoes-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MERCADO AO VIVO</span>
            <h2>Cotações por Categoria (@)</h2>
          </div>
          <span className="muted">{data.cotacao?.data_referencia ? `Ref: ${data.cotacao.data_referencia}` : ''}</span>
        </div>
        <div className="cotacoes-grid">
          {cotacoesCategorias.map(([catNome, catInfo]) => (
            <div className="cotacao-item" key={catNome}>
              <span className="cotacao-nome">{catNome}</span>
              <strong>{money(catInfo.preco)}</strong>
              <small title={catInfo.fonte}>{catInfo.fonte}</small>
            </div>
          ))}
        </div>
      </section>
    )}

    <section className="panel"><div className="section-heading"><div><span className="eyebrow">INDICADORES</span><h2>Resumo do lote</h2></div></div><div className="indicator-grid"><Metric label="Peso registrado" value={`${number((weighed.length / animals.length) * 100)}%`} detail={`${weighed.length} de ${animals.length} animais`} /><Metric label="Classificados" value={`${animals.filter((animal) => animal.categoria).length}`} detail="Com categoria definida" /><Metric label="Valor médio" value={money(totalValue / (animals.length || 1))} detail="Por animal" /></div></section>
    <section className="charts"><div className="panel chart"><h2>Raças</h2><Bar data={chartData(distributions.raca || [], 'Animais por raça')} options={{ ...chartOptions, plugins: { legend: { display: false } } }} /></div><div className="panel chart"><h2>Categorias</h2><Doughnut data={chartData(distributions.categoria || [], 'Distribuição por categoria')} options={chartOptions} /></div><div className="panel sex-card"><h2>Composição por sexo</h2>{(distributions.sexo || []).map((item) => <div className="sex-row" key={item.nome}><span>{item.nome}</span><strong>{number((Number(item.quantidade) / (sexTotal || 1)) * 100)}%</strong><small>{item.quantidade} animais</small></div>)}</div></section>
    <section className="panel chart wide-chart"><h2>Evolução de peso do lote</h2>{trend.length ? <Line data={{ labels: trend.map((item) => item.x), datasets: [{ label: 'Peso médio (kg)', data: trend.map((item) => item.y), borderColor: '#176b4d', backgroundColor: 'rgba(23, 107, 77, 0.12)', fill: true, tension: 0.35 }] }} options={chartOptions} /> : <p className="muted">Selecione um lote com histórico de pesagens para visualizar a evolução.</p>}</section>
    <section className="panel table-panel">
      <div className="section-heading"><div><span className="eyebrow">REBANHO</span><h2>Animais do lote</h2></div><span>{animals.length} registros</span></div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Brinco</th>
              <th>Raça</th>
              <th>Sexo</th>
              <th>Idade</th>
              <th>Categoria</th>
              <th>Peso atual</th>
              <th>Cria / Vínculo</th>
              <th>Cotação / @</th>
              <th>Valor estimado</th>
            </tr>
          </thead>
          <tbody>
            {animals.map((animal) => (
              <tr key={animal.id}>
                <td><b>{animal.id_brinco}</b></td>
                <td>{animal.raca}</td>
                <td>{animal.sexo}</td>
                <td>{animal.idade_meses ?? '—'} meses</td>
                <td><span className="tag">{animal.categoria || 'Sem categoria'}</span></td>
                <td>{animal.peso_atual_kg != null ? `${number(animal.peso_atual_kg)} kg` : '—'}</td>
                <td>
                  {animal.cria_ao_pe ? (
                    <span className="cria-tag" title={`Cria: Brinco ${animal.cria_ao_pe.id_brinco}`}>🍼 Cria: {animal.cria_ao_pe.id_brinco}</span>
                  ) : animal.mae_brinco ? (
                    <span className="mae-tag" title={`Mãe: Brinco ${animal.mae_brinco}`}>🐮 Mãe: {animal.mae_brinco}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{money(animal.preco_arroba_aplicado)}</td>
                <td><strong>{money(animal.valor_estimado)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}

function Operations(props) {
  const {
    lotes,
    animals,
    loteForm,
    setLoteForm,
    animalForm,
    setAnimalForm,
    weightForm,
    setWeightForm,
    transferForm,
    setTransferForm,
    vincularCriaForm,
    setVincularCriaForm,
    submitLote,
    submitAnimal,
    submitWeight,
    submitTransfer,
    submitVincularCria,
    hardwareStatus,
    hardwareBusy,
    configureHardware,
    autoWeigh,
    cotacaoForm,
    setCotacaoForm,
    submitCotacao,
    syncMarketPrice,
    syncingCotacao,
    currentCotacao
  } = props;
  const update = (setter, field) => (event) => setter((current) => ({ ...current, [field]: event.target.value }));

  const vacas = animals.filter((a) => a.sexo === 'femea');
  const bezerrada = animals.filter((a) => a.idade_meses == null || a.idade_meses <= 12 || a.categoria?.includes('Bezer'));

  return <section className="operations">
    <div className="section-heading"><div><span className="eyebrow">OPERAÇÃO</span><h2>Cadastros e manejo</h2></div><p>Registre as movimentações sem sair do painel.</p></div>
    <div className="operation-grid">
      <form className="operation-card" onSubmit={submitLote}>
        <h3>Novo lote</h3>
        <Field label="Nome do lote"><input required value={loteForm.nome} onChange={update(setLoteForm, 'nome')} placeholder="Ex.: Confinamento C" /></Field>
        <Field label="Descrição"><input value={loteForm.descricao} onChange={update(setLoteForm, 'descricao')} placeholder="Ex.: Novilhas em recria" /></Field>
        <button className="primary">Salvar lote</button>
      </form>

      <form className="operation-card" onSubmit={submitAnimal}>
        <h3>Novo animal</h3>
        <div className="compact-fields">
          <Field label="Brinco"><input required value={animalForm.id_brinco} onChange={update(setAnimalForm, 'id_brinco')} /></Field>
          <Field label="Raça"><input required value={animalForm.raca} onChange={update(setAnimalForm, 'raca')} /></Field>
          <Field label="Sexo"><select value={animalForm.sexo} onChange={update(setAnimalForm, 'sexo')}><option value="macho">Macho</option><option value="femea">Fêmea</option></select></Field>
          <Field label="Lote"><select required value={animalForm.lote_id} onChange={update(setAnimalForm, 'lote_id')}>{lotes.length === 0 ? <option value="">Cadastre um lote primeiro</option> : lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select></Field>
          <Field label="Data de nascimento"><input required type="date" value={animalForm.data_nascimento} onChange={update(setAnimalForm, 'data_nascimento')} /></Field>
          <Field label="Data de entrada"><input required type="date" value={animalForm.data_entrada} onChange={update(setAnimalForm, 'data_entrada')} /></Field>
          <Field label="Condição reprodutiva"><select value={animalForm.condicao_reprodutiva} onChange={update(setAnimalForm, 'condicao_reprodutiva')}><option value="">Não informar</option><option value="inteiro">Inteiro</option><option value="castrado">Castrado</option><option value="vazia">Vazia</option><option value="prenha">Prenha</option><option value="com_cria_ao_pe">Com cria ao pé</option></select></Field>
          <Field label="Vaca mãe (se for cria)"><select value={animalForm.mae_id} onChange={update(setAnimalForm, 'mae_id')}><option value="">Nenhuma / Sem mãe</option>{vacas.map((vaca) => <option key={vaca.id} value={vaca.id}>{vaca.id_brinco} · {vaca.raca}</option>)}</select></Field>
          <Field label="Peso inicial (kg)"><input type="number" min="50" max="2000" step="0.1" value={animalForm.peso_kg} onChange={update(setAnimalForm, 'peso_kg')} /></Field>
        </div>
        <button className="primary">Salvar animal</button>
      </form>

      <form className="operation-card" onSubmit={submitVincularCria}>
        <h3>🍼 Vincular Cria à Vaca</h3>
        <p>Associe uma vaca com cria ao pé com o bezerro(a) correspondente no lote.</p>
        <Field label="Vaca (Mãe)"><select required value={vincularCriaForm.mae_id} onChange={update(setVincularCriaForm, 'mae_id')}>{vacas.length === 0 ? <option value="">Nenhuma fêmea no lote</option> : vacas.map((vaca) => <option key={vaca.id} value={vaca.id}>{vaca.id_brinco} · {vaca.raca}</option>)}</select></Field>
        <Field label="Bezerro(a) (Cria)"><select required value={vincularCriaForm.cria_id} onChange={update(setVincularCriaForm, 'cria_id')}>{bezerrada.length === 0 ? <option value="">Nenhuma cria disponível</option> : bezerrada.map((cria) => <option key={cria.id} value={cria.id}>{cria.id_brinco} · {cria.raca} ({cria.sexo})</option>)}</select></Field>
        <button className="primary">Vincular Par Mãe-Cria</button>
      </form>

      <form className="operation-card" onSubmit={submitWeight}>
        <h3>Pesagem manual</h3>
        <Field label="Animal"><select required value={weightForm.animal_id} onChange={update(setWeightForm, 'animal_id')}>{animals.length === 0 ? <option value="">Nenhum animal no lote</option> : animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.id_brinco} · {animal.raca}</option>)}</select></Field>
        <Field label="Peso (kg)"><input required type="number" min="0.1" step="0.1" value={weightForm.peso_kg} onChange={update(setWeightForm, 'peso_kg')} /></Field>
        <Field label="Data"><input required type="date" value={weightForm.data_pesagem} onChange={update(setWeightForm, 'data_pesagem')} /></Field>
        <button className="primary">Registrar peso</button>
      </form>

      <form className="operation-card" onSubmit={submitTransfer}>
        <h3>Transferir animal</h3>
        <Field label="Animal"><select required value={transferForm.animal_id} onChange={update(setTransferForm, 'animal_id')}>{animals.length === 0 ? <option value="">Nenhum animal disponível</option> : animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.id_brinco} · {animal.raca}</option>)}</select></Field>
        <Field label="Novo lote"><select required value={transferForm.lote_id} onChange={update(setTransferForm, 'lote_id')}>{lotes.length === 0 ? <option value="">Nenhum lote cadastrado</option> : lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select></Field>
        <button className="secondary">Transferir</button>
      </form>

      <article className="operation-card">
        <h3>Cotação de mercado (@)</h3>
        <p>Boi Gordo CEPEA: <strong>{currentCotacao?.preco ? money(currentCotacao.preco) : '—'}</strong></p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button type="button" className="primary" disabled={syncingCotacao} onClick={syncMarketPrice}>
            {syncingCotacao ? 'Consultando mercado...' : 'Sincronizar Mercado ao Vivo'}
          </button>
        </div>
        <form onSubmit={submitCotacao}>
          <Field label="Categoria da Cotação">
            <select value={cotacaoForm.categoria} onChange={update(setCotacaoForm, 'categoria')}>
              <option value="Boi gordo">Boi gordo (Padrão)</option>
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
          <Field label="Definir preço manual (R$/@)">
            <input required type="number" min="1" step="0.01" value={cotacaoForm.preco} onChange={update(setCotacaoForm, 'preco')} placeholder="Ex.: 345.50" />
          </Field>
          <button className="secondary">Salvar cotação da categoria</button>
        </form>
      </article>

      <article className="operation-card hardware">
        <h3>Pesagem automática</h3>
        <p>Use a câmera para identificar o brinco e a balança conectada para registrar o peso estável.</p>
        <div className="hardware-status">{hardwareStatus}</div>
        <button className="secondary" disabled={hardwareBusy} onClick={configureHardware}>Configurar hardware</button>
        <button className="primary" disabled={hardwareBusy} onClick={autoWeigh}>{hardwareBusy ? 'Processando...' : 'Iniciar pesagem'}</button>
      </article>
    </div>
  </section>;
}
