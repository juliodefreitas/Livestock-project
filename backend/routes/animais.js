const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const herdService = require('../services/herdService');
const { calcularIdadeMeses } = require('../services/calculationService');
const {
  ValidationError,
  validateSexo,
  validateCondicaoReprodutiva,
  validateDateField,
  validatePositiveInteger,
  ensureRecordExists,
} = require('../utils/validation');

router.get('/', async (req, res) => {
  try {
    const filtros = {
      lote_id: req.query.lote_id ? parseInt(req.query.lote_id, 10) : undefined,
      sexo: req.query.sexo,
    };
    const data = await herdService.getRebanho(filtros);
    res.json(data);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const ficha = await herdService.getAnimalFicha(parseInt(req.params.id, 10));
    if (!ficha) return res.status(404).json({ erro: 'Animal não encontrado' });
    res.json(ficha);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/', (req, res, next) => {
  try {
    const {
      id_brinco,
      raca,
      sexo,
      data_nascimento,
      idade_estimada_meses,
      condicao_reprodutiva,
      data_entrada,
      lote_id,
    } = req.body;

    if (!id_brinco || !raca) {
      return res.status(400).json({ erro: 'id_brinco e raca são obrigatórios' });
    }

    const sexoValidado = validateSexo(sexo);
    const condicaoValidada = validateCondicaoReprodutiva(condicao_reprodutiva);
    const dataEntradaValidada = validateDateField(data_entrada, 'data_entrada');
    const loteIdValidado = validatePositiveInteger(lote_id, 'lote_id');
    const dataNascimentoValidada = data_nascimento ? validateDateField(data_nascimento, 'data_nascimento') : null;
    const idadeEstimadaValidada = idade_estimada_meses == null ? null : validatePositiveInteger(idade_estimada_meses, 'idade_estimada_meses');

    ensureRecordExists(db, 'lote', loteIdValidado, 'lote_id');

    const result = db
      .prepare(`
        INSERT INTO animal (id_brinco, raca, sexo, data_nascimento, idade_estimada_meses, condicao_reprodutiva, data_entrada, lote_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id_brinco,
        raca,
        sexoValidado,
        dataNascimentoValidada,
        idadeEstimadaValidada,
        condicaoValidada,
        dataEntradaValidada,
        loteIdValidado
      );

    const animal = db.prepare('SELECT * FROM animal WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...animal,
      idade_meses: calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses),
    });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ erro: 'Brinco já cadastrado' });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ erro: err.message });
    }
    if (err.message.includes('not found')) {
      return res.status(404).json({ erro: err.message });
    }
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const id = validatePositiveInteger(req.params.id, 'id');
    const existing = db.prepare('SELECT * FROM animal WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ erro: 'Animal não encontrado' });

    const {
      id_brinco = existing.id_brinco,
      raca = existing.raca,
      sexo = existing.sexo,
      data_nascimento = existing.data_nascimento,
      idade_estimada_meses = existing.idade_estimada_meses,
      condicao_reprodutiva = existing.condicao_reprodutiva,
      data_entrada = existing.data_entrada,
      lote_id = existing.lote_id,
    } = req.body;

    const sexoValidado = validateSexo(sexo);
    const condicaoValidada = validateCondicaoReprodutiva(condicao_reprodutiva);
    const dataEntradaValidada = validateDateField(data_entrada, 'data_entrada');
    const loteIdValidado = validatePositiveInteger(lote_id, 'lote_id');
    const dataNascimentoValidada = data_nascimento ? validateDateField(data_nascimento, 'data_nascimento') : null;
    const idadeEstimadaValidada = idade_estimada_meses == null ? null : validatePositiveInteger(idade_estimada_meses, 'idade_estimada_meses');

    ensureRecordExists(db, 'lote', loteIdValidado, 'lote_id');

    db.prepare(`
      UPDATE animal SET
        id_brinco = ?, raca = ?, sexo = ?, data_nascimento = ?,
        idade_estimada_meses = ?, condicao_reprodutiva = ?,
        data_entrada = ?, lote_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      id_brinco, raca, sexoValidado, dataNascimentoValidada, idadeEstimadaValidada,
      condicaoValidada, dataEntradaValidada, loteIdValidado, id
    );

    const animal = db.prepare('SELECT * FROM animal WHERE id = ?').get(id);
    res.json({
      ...animal,
      idade_meses: calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses),
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ erro: err.message });
    }
    if (err.message.includes('not found')) {
      return res.status(404).json({ erro: err.message });
    }
    next(err);
  }
});

module.exports = router;
