import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Erro na renderização do React:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '40px auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2b3b3', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#b23b3b', marginTop: 0 }}>Ops, ocorreu um erro ao carregar o painel</h2>
          <p style={{ color: '#555' }}>
            Detalhes do erro: <code>{this.state.error?.message || String(this.state.error)}</code>
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              style={{ background: '#156245', color: '#fff', border: 0, padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Recarregar Página
            </button>
            <button
              style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ccc', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' }}
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >
              Limpar Dados e Fazer Login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
