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

runMigrations();
seed();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/animais', animaisRouter);
app.use('/api/lotes', lotesRouter);
app.use('/api/rebanho', rebanhoRouter);
app.use('/api/cotacao', cotacaoRouter);
app.use('/api/pesagens', pesagensRouter);

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', modulo: 'analise-rebanho' });
});

app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Pecuária Smart rodando em http://localhost:${PORT}`);
});

module.exports = app;
