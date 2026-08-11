const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const herdService = require('../services/herdService');

router.get('/', (req, res) => {
  try {
    const lotes = db.prepare('SELECT * FROM lote ORDER BY nome').all();
    res.json(lotes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const agregado = await herdService.getLoteAgregado(parseInt(req.params.id, 10));
    if (!agregado) return res.status(404).json({ erro: 'Lote não encontrado' });
    res.json(agregado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome do lote é obrigatório' });

    const result = db.prepare('INSERT INTO lote (nome, descricao) VALUES (?, ?)').run(nome, descricao || null);
    const lote = db.prepare('SELECT * FROM lote WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(lote);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Lote com este nome já existe' });
    }
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
