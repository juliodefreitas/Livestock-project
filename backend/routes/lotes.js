const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const herdService = require('../services/herdService');
const { ValidationError, validatePositiveInteger } = require('../utils/validation');

router.get('/', (req, res, next) => {
  try {
    const lotes = db.prepare('SELECT * FROM lote WHERE fazenda_id = ? ORDER BY nome').all(req.fazenda.id);
    res.json(lotes);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = validatePositiveInteger(req.params.id, 'id');
    const agregado = await herdService.getLoteAgregado(id, req.fazenda.id);
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

    const result = db.prepare('INSERT INTO lote (nome, descricao, fazenda_id) VALUES (?, ?, ?)').run(
      nome, descricao || null, req.fazenda.id,
    );
    const lote = db.prepare('SELECT * FROM lote WHERE id = ? AND fazenda_id = ?').get(result.lastInsertRowid, req.fazenda.id);
    res.status(201).json(lote);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Lote com este nome já existe' });
    }
    next(err);
  }
});

module.exports = router;
