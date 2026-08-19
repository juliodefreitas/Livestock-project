const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const herdService = require('../services/herdService');
const { ValidationError, validatePositiveInteger } = require('../utils/validation');

router.get('/', (req, res, next) => {
  try {
    const lotes = db.prepare('SELECT * FROM lote ORDER BY nome').all();
    res.json(lotes);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = validatePositiveInteger(req.params.id, 'id');
    const agregado = await herdService.getLoteAgregado(id);
    if (!agregado) return res.status(404).json({ erro: 'Lote não encontrado' });
    res.json(agregado);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ erro: err.message });
    }
    next(err);
  }
});

router.post('/', (req, res, next) => {
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
    next(err);
  }
});

module.exports = router;
