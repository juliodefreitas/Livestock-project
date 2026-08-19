const express = require('express');
const cors = require('cors');
const path = require('path');
const { runMigrations } = require('./db/migrate');
const { seed } = require('./db/seed');

const animaisRouter = require('./routes/animais');
const lotesRouter = require('./routes/lotes');
const rebanhoRouter = require('./routes/rebanho');
const cotacaoRouter = require('./routes/cotacao');
const pesagensRouter = require('./routes/pesagens');
const cameraRouter = require('./routes/camera');
const pesagensCamera = require('./routes/pesagensCamera');

runMigrations();

if (process.argv.includes('--seed')) {
  seed();
} else {
  console.log('Seed não executado. Use "npm run seed" para popular o banco com dados de exemplo.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar CORS seguro
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting simples (em memória)
const rateLimit = require('./utils/rateLimit');
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 100
}));

// Rotas da API
app.use('/api/animais', animaisRouter);
app.use('/api/lotes', lotesRouter);
app.use('/api/rebanho', rebanhoRouter);
app.use('/api/cotacao', cotacaoRouter);
app.use('/api/pesagens', pesagensRouter);
app.use('/api/camera', cameraRouter);
app.use('/api/pesagens', pesagensCamera);

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', modulo: 'analise-rebanho' });
});

// Middleware de erro
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  console.error('Erro não tratado:', err);

  res.status(statusCode).json({
    erro: isDevelopment ? err.message : 'Erro interno do servidor',
    ...(isDevelopment && { stack: err.stack })
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Pecuária Smart rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
