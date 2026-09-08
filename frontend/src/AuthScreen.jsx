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

  const prefillDemo = () => {
    setMode('login');
    setForm({ nome: '', cnpj: '12.345.678/0001-90', senha: 'senha-segura-123' });
    setError('');
  };

  return (
    <main className="auth-page">
      {/* Lado Esquerdo: Banner Visual / Hero */}
      <section className="auth-hero">
        <div className="auth-hero-content">
          <div className="auth-hero-brand">
            <div className="auth-logo-badge">🐂</div>
            <div className="auth-logo-text">
              <span className="auth-brand-name">Pecuária Smart</span>
              <span className="auth-brand-tag">Gestão Inteligente</span>
            </div>
          </div>

          <div className="auth-hero-main">
            <span className="auth-hero-pill">✨ Tecnologia Pecuária de Alta Precisão</span>
            <h1>O controle do seu rebanho na palma da sua mão.</h1>
            <p>
              Acompanhamento de ganho de peso (GMD), cotação da arroba ao vivo pelo CEPEA,
              vínculo de matrizes e bezerros com inteligência zootécnica.
            </p>
          </div>

          <div className="auth-hero-features">
            <div className="feature-item">
              <div className="feature-icon">📈</div>
              <div>
                <strong>Cotação da Arroba em Tempo Real</strong>
                <span>Valores atualizados por categoria de gado</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🍼</div>
              <div>
                <strong>Manejo de Cria ao Pé</strong>
                <span>Rastreabilidade de matrizes e bezerros no lote</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <div>
                <strong>Segurança Multi-Fazenda</strong>
                <span>Isolamento e sigilo total dos dados por CNPJ</span>
              </div>
            </div>
          </div>

          <div className="auth-hero-footer">
            <span>© {new Date().getFullYear()} Pecuária Smart • Todos os direitos reservados</span>
          </div>
        </div>
      </section>

      {/* Lado Direito: Formulário com Card Moderno */}
      <section className="auth-form-wrapper">
        <div className="auth-glass-card">
          <div className="auth-card-header">
            <span className="auth-card-badge">
              {mode === 'login' ? '🔐 Acesso Seguro' : '🚀 Novo Acesso'}
            </span>
            <h2>{mode === 'login' ? 'Bem-vindo de volta' : 'Cadastre sua Fazenda'}</h2>
            <p className="subtitle">
              {mode === 'login'
                ? 'Informe o CNPJ da sua fazenda e sua senha para acessar o painel.'
                : 'Preencha os dados abaixo para iniciar a gestão do seu rebanho.'}
            </p>
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && (
              <div className="auth-field-group">
                <label className="auth-field-label">Nome da Fazenda / Propriedade</label>
                <div className="input-with-icon">
                  <span className="input-icon">🏡</span>
                  <input
                    required
                    minLength="2"
                    type="text"
                    value={form.nome}
                    onChange={update('nome')}
                    placeholder="Ex: Fazenda Santa Maria"
                    className="auth-input"
                  />
                </div>
              </div>
            )}

            <div className="auth-field-group">
              <label className="auth-field-label">CNPJ da Propriedade</label>
              <div className="input-with-icon">
                <span className="input-icon">📋</span>
                <input
                  required
                  inputMode="numeric"
                  type="text"
                  value={form.cnpj}
                  onChange={update('cnpj')}
                  placeholder="00.000.000/0000-00"
                  className="auth-input font-mono"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label className="auth-field-label">Senha de Acesso</label>
              <div className="input-with-icon">
                <span className="input-icon">🔑</span>
                <input
                  required
                  minLength="8"
                  type="password"
                  value={form.senha}
                  onChange={update('senha')}
                  placeholder="Mínimo de 8 caracteres"
                  className="auth-input"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            </div>

            {error && (
              <div className="auth-error-box" role="alert">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn-auth-submit" disabled={busy}>
              {busy ? (
                <span className="loading-spinner">⏳ Autenticando...</span>
              ) : mode === 'login' ? (
                'Entrar no Sistema ➔'
              ) : (
                'Criar Conta da Fazenda ➔'
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>ou</span>
          </div>

          <button
            type="button"
            className="btn-demo-fill"
            onClick={prefillDemo}
            title="Preenche com os dados da fazenda teste para login rápido"
          >
            ⚡ Preencher dados da Fazenda Demo
          </button>

          <div className="auth-card-footer">
            <p>
              {mode === 'login' ? 'Ainda não tem conta na sua fazenda?' : 'Já possui cadastro?'}
              <button
                type="button"
                className="auth-toggle-btn"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
              >
                {mode === 'login' ? 'Cadastre-se agora' : 'Faça login aqui'}
              </button>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
