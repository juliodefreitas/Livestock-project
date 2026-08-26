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
  const response = await fetch(`${apiBase}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.erro || data.message || `Erro na requisição (${response.status})`);
  return data;
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
  const [view, setView] = useState('home');
  const [lotes, setLotes] = useState([]);
  const [loteId, setLoteId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [loteForm, setLoteForm] = useState({ nome: '', descricao: '' });
  const [animalForm, setAnimalForm] = useState({ id_brinco: '', raca: '', sexo: 'macho', data_nascimento: '', lote_id: '', data_entrada: today, condicao_reprodutiva: '', peso_kg: '' });
  const [weightForm, setWeightForm] = useState({ animal_id: '', peso_kg: '', data_pesagem: today });
  const [transferForm, setTransferForm] = useState({ animal_id: '', lote_id: '' });
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
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    loadLotes().catch((error) => setNotice({ type: 'error', text: error.message }));
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (view === 'dashboard') loadDashboard();
  }, [view, loteId]);

  useEffect(() => {
    if (animals.length) {
      setWeightForm((current) => current.animal_id ? current : { ...current, animal_id: String(animals[0].id) });
      setTransferForm((current) => current.animal_id ? current : { ...current, animal_id: String(animals[0].id) });
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
      await refresh('Lote cadastrado com sucesso.');
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const submitAnimal = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...animalForm, lote_id: Number(animalForm.lote_id), peso_kg: animalForm.peso_kg ? Number(animalForm.peso_kg) : undefined };
      await request('/animais', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      setAnimalForm({ id_brinco: '', raca: '', sexo: 'macho', data_nascimento: '', lote_id: animalForm.lote_id, data_entrada: today, condicao_reprodutiva: '', peso_kg: '' });
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">PS</span><div><strong>Pecuária Smart</strong><small>Gestão de rebanho</small></div></div>
        <nav aria-label="Navegação principal">
          <button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>Início</button>
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Painel</button>
        </nav>
        <span className={`connection ${online ? '' : 'offline'}`}>{online ? 'Online' : 'Modo offline'}</span>
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
            <Operations lotes={lotes} animals={animals} loteForm={loteForm} setLoteForm={setLoteForm} animalForm={animalForm} setAnimalForm={setAnimalForm} weightForm={weightForm} setWeightForm={setWeightForm} transferForm={transferForm} setTransferForm={setTransferForm} submitLote={submitLote} submitAnimal={submitAnimal} submitWeight={submitWeight} submitTransfer={submitTransfer} hardwareStatus={hardwareStatus} hardwareBusy={hardwareBusy} configureHardware={configureHardware} autoWeigh={autoWeigh} />
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
  return <div className="dashboard">
    <section className="metrics"><Metric label="Animais no filtro" value={data.total} detail="Registros ativos" /><Metric label="Peso médio" value={`${number(weighed.length ? totalWeight / weighed.length : 0)} kg`} detail={`${weighed.length} com peso atualizado`} /><Metric label="Valor estimado" value={money(totalValue)} detail="Valor consolidado" /><Metric label="Cotação da arroba" value={money(data.cotacao?.preco)} detail={data.cotacao?.fonte || 'Sem fonte'} /></section>
    <section className="panel"><div className="section-heading"><div><span className="eyebrow">INDICADORES</span><h2>Resumo do lote</h2></div></div><div className="indicator-grid"><Metric label="Peso registrado" value={`${number((weighed.length / animals.length) * 100)}%`} detail={`${weighed.length} de ${animals.length} animais`} /><Metric label="Classificados" value={`${animals.filter((animal) => animal.categoria).length}`} detail="Com categoria definida" /><Metric label="Valor médio" value={money(totalValue / animals.length)} detail="Por animal" /></div></section>
    <section className="charts"><div className="panel chart"><h2>Raças</h2><Bar data={chartData(distributions.raca || [], 'Animais por raça')} options={{ ...chartOptions, plugins: { legend: { display: false } } }} /></div><div className="panel chart"><h2>Categorias</h2><Doughnut data={chartData(distributions.categoria || [], 'Distribuição por categoria')} options={chartOptions} /></div><div className="panel sex-card"><h2>Composição por sexo</h2>{(distributions.sexo || []).map((item) => <div className="sex-row" key={item.nome}><span>{item.nome}</span><strong>{number((Number(item.quantidade) / sexTotal) * 100)}%</strong><small>{item.quantidade} animais</small></div>)}</div></section>
    <section className="panel chart wide-chart"><h2>Evolução de peso do lote</h2>{trend.length ? <Line data={{ labels: trend.map((item) => item.x), datasets: [{ label: 'Peso médio (kg)', data: trend.map((item) => item.y), borderColor: '#176b4d', backgroundColor: 'rgba(23, 107, 77, 0.12)', fill: true, tension: 0.35 }] }} options={chartOptions} /> : <p className="muted">Selecione um lote com histórico de pesagens para visualizar a evolução.</p>}</section>
    <section className="panel table-panel"><div className="section-heading"><div><span className="eyebrow">REBANHO</span><h2>Animais do lote</h2></div><span>{animals.length} registros</span></div><div className="table-scroll"><table><thead><tr><th>Brinco</th><th>Raça</th><th>Sexo</th><th>Idade</th><th>Categoria</th><th>Peso atual</th><th>Valor estimado</th></tr></thead><tbody>{animals.map((animal) => <tr key={animal.id}><td><b>{animal.id_brinco}</b></td><td>{animal.raca}</td><td>{animal.sexo}</td><td>{animal.idade_meses ?? '—'} meses</td><td><span className="tag">{animal.categoria || 'Sem categoria'}</span></td><td>{animal.peso_atual_kg != null ? `${number(animal.peso_atual_kg)} kg` : '—'}</td><td>{money(animal.valor_estimado)}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function Operations(props) {
  const { lotes, animals, loteForm, setLoteForm, animalForm, setAnimalForm, weightForm, setWeightForm, transferForm, setTransferForm, submitLote, submitAnimal, submitWeight, submitTransfer, hardwareStatus, hardwareBusy, configureHardware, autoWeigh } = props;
  const update = (setter, field) => (event) => setter((current) => ({ ...current, [field]: event.target.value }));
  return <section className="operations"><div className="section-heading"><div><span className="eyebrow">OPERAÇÃO</span><h2>Cadastros e manejo</h2></div><p>Registre as movimentações sem sair do painel.</p></div><div className="operation-grid">
    <form className="operation-card" onSubmit={submitLote}><h3>Novo lote</h3><Field label="Nome do lote"><input required value={loteForm.nome} onChange={update(setLoteForm, 'nome')} placeholder="Ex.: Confinamento C" /></Field><Field label="Descrição"><input value={loteForm.descricao} onChange={update(setLoteForm, 'descricao')} placeholder="Ex.: Novilhas em recria" /></Field><button className="primary">Salvar lote</button></form>
    <form className="operation-card" onSubmit={submitAnimal}><h3>Novo animal</h3><div className="compact-fields"><Field label="Brinco"><input required value={animalForm.id_brinco} onChange={update(setAnimalForm, 'id_brinco')} /></Field><Field label="Raça"><input required value={animalForm.raca} onChange={update(setAnimalForm, 'raca')} /></Field><Field label="Sexo"><select value={animalForm.sexo} onChange={update(setAnimalForm, 'sexo')}><option value="macho">Macho</option><option value="femea">Fêmea</option></select></Field><Field label="Lote"><select required value={animalForm.lote_id} onChange={update(setAnimalForm, 'lote_id')}>{lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select></Field><Field label="Data de entrada"><input required type="date" value={animalForm.data_entrada} onChange={update(setAnimalForm, 'data_entrada')} /></Field><Field label="Peso inicial (kg)"><input type="number" min="50" max="2000" step="0.1" value={animalForm.peso_kg} onChange={update(setAnimalForm, 'peso_kg')} /></Field></div><button className="primary">Salvar animal</button></form>
    <form className="operation-card" onSubmit={submitWeight}><h3>Pesagem manual</h3><Field label="Animal"><select required value={weightForm.animal_id} onChange={update(setWeightForm, 'animal_id')}>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.id_brinco} · {animal.raca}</option>)}</select></Field><Field label="Peso (kg)"><input required type="number" min="0.1" step="0.1" value={weightForm.peso_kg} onChange={update(setWeightForm, 'peso_kg')} /></Field><Field label="Data"><input required type="date" value={weightForm.data_pesagem} onChange={update(setWeightForm, 'data_pesagem')} /></Field><button className="primary">Registrar peso</button></form>
    <form className="operation-card" onSubmit={submitTransfer}><h3>Transferir animal</h3><Field label="Animal"><select required value={transferForm.animal_id} onChange={update(setTransferForm, 'animal_id')}>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.id_brinco} · {animal.raca}</option>)}</select></Field><Field label="Novo lote"><select required value={transferForm.lote_id} onChange={update(setTransferForm, 'lote_id')}>{lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.nome}</option>)}</select></Field><button className="secondary">Transferir</button></form>
    <article className="operation-card hardware"><h3>Pesagem automática</h3><p>Use a câmera para identificar o brinco e a balança conectada para registrar o peso estável.</p><div className="hardware-status">{hardwareStatus}</div><button className="secondary" disabled={hardwareBusy} onClick={configureHardware}>Configurar hardware</button><button className="primary" disabled={hardwareBusy} onClick={autoWeigh}>{hardwareBusy ? 'Processando...' : 'Iniciar pesagem'}</button></article>
  </div></section>;
}
