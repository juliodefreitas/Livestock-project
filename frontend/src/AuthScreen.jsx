import { useState } from 'react';

const formatCnpj = (value) => value.replace(/\D/g, '').slice(0, 14).replace(
  /^(\d{2})(\d)/, '$1.$2',
).replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ nome: '', cnpj: '', senha: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (event) => {
    const value = field === 'cnpj' ? formatCnpj(event.target.value) : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'cadastro'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.erro || 'Não foi possível autenticar');
      onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message === 'Failed to fetch' ? 'Falha de conexão com o servidor. Verifique se o backend está em execução.' : requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-hero"><span className="brand-mark">PS</span><span className="eyebrow">PECUÁRIA SMART</span><h1>Gestão segura para a sua fazenda.</h1><p>Dados do rebanho organizados por CNPJ, em uma experiência adequada à rotina do campo.</p></section>
    <section className="auth-card"><div><span className="eyebrow">{mode === 'login' ? 'ACESSO DA FAZENDA' : 'PRIMEIRO ACESSO'}</span><h2>{mode === 'login' ? 'Entrar na plataforma' : 'Cadastrar fazenda'}</h2><p>{mode === 'login' ? 'Use o CNPJ e a senha cadastrados.' : 'Crie o acesso da sua fazenda em poucos passos.'}</p></div>
      <form onSubmit={submit}>
        {mode === 'register' && <label className="field"><span>Nome da fazenda</span><input required minLength="2" value={form.nome} onChange={update('nome')} placeholder="Ex.: Fazenda Boa Vista" /></label>}
        <label className="field"><span>CNPJ</span><input required inputMode="numeric" value={form.cnpj} onChange={update('cnpj')} placeholder="00.000.000/0000-00" /></label>
        <label className="field"><span>Senha</span><input required minLength="8" type="password" value={form.senha} onChange={update('senha')} placeholder="Mínimo de 8 caracteres" /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar acesso'}</button>
      </form>
      <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Ainda não tenho cadastro' : 'Já tenho acesso'}</button>
    </section>
  </main>;
}
