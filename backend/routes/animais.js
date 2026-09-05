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
  validateIdadeOuNascimento,
  ensureRecordExists,
} = require('../utils/validation');

router.get('/', async (req, res, next) => {
  try {
    const filtros = {
      lote_id: req.query.lote_id ? parseInt(req.query.lote_id, 10) : undefined,
      sexo: req.query.sexo,
    };
    const data = await herdService.getRebanho(filtros, req.fazenda.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = validatePositiveInteger(req.params.id, 'id');
    const ficha = await herdService.getAnimalFicha(id, req.fazenda.id);
    if (!ficha) return res.status(404).json({ erro: 'Animal não encontrado' });
    res.json(ficha);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ erro: err.message });
    }
    next(err);
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
      peso_kg,
      mae_id,
    } = req.body;

    if (!id_brinco || !raca) {
      return res.status(400).json({ erro: 'id_brinco e raca são obrigatórios' });
    }

    const sexoValidado = validateSexo(sexo);
    const condicaoValidada = validateCondicaoReprodutiva(condicao_reprodutiva);
    const dataEntradaValidada = validateDateField(data_entrada, 'data_entrada');
    const loteIdValidado = validatePositiveInteger(lote_id, 'lote_id');
    const maeIdValidado = mae_id ? validatePositiveInteger(mae_id, 'mae_id') : null;
    const dataNascimentoValidada = data_nascimento ? validateDateField(data_nascimento, 'data_nascimento') : null;
    const idadeEstimadaValidada = idade_estimada_meses == null ? null : validatePositiveInteger(idade_estimada_meses, 'idade_estimada_meses');
    const pesoInicialValidado = peso_kg == null || peso_kg === '' ? null : require('../utils/validation').validatePesoKg(peso_kg);
    validateIdadeOuNascimento(dataNascimentoValidada, idadeEstimadaValidada);

    const lote = db.prepare('SELECT id FROM lote WHERE id = ? AND fazenda_id = ?').get(loteIdValidado, req.fazenda.id);
    if (!lote) return res.status(404).json({ erro: 'lote_id não encontrado' });

    if (maeIdValidado) {
      const mae = db.prepare(`
        SELECT a.id, a.sexo, a.lote_id FROM animal a JOIN lote l ON l.id = a.lote_id
        WHERE a.id = ? AND l.fazenda_id = ?
      `).get(maeIdValidado, req.fazenda.id);
      if (!mae) return res.status(404).json({ erro: 'Vaca/mãe não encontrada nesta fazenda' });
      if (mae.sexo !== 'femea') return res.status(400).json({ erro: 'A mãe informada deve ser uma fêmea' });
    }

    const transaction = db.transaction(() => {
      const result = db
        .prepare(`
        INSERT INTO animal (id_brinco, raca, sexo, data_nascimento, idade_estimada_meses, condicao_reprodutiva, data_entrada, lote_id, mae_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .run(
          id_brinco, raca, sexoValidado, dataNascimentoValidada,
          idadeEstimadaValidada, condicaoValidada, dataEntradaValidada, loteIdValidado, maeIdValidado
        );

      if (pesoInicialValidado != null) {
        db.prepare('INSERT INTO pesagem (animal_id, peso_kg, data_pesagem, origem) VALUES (?, ?, ?, ?)')
          .run(result.lastInsertRowid, pesoInicialValidado, dataEntradaValidada, 'manual');
      }

      // Se informou mãe, podemos atualizar a condição reprodutiva da mãe para 'com_cria_ao_pe' se estiver vazia
      if (maeIdValidado) {
        db.prepare(`
          UPDATE animal SET condicao_reprodutiva = 'com_cria_ao_pe', updated_at = datetime('now')
          WHERE id = ? AND (condicao_reprodutiva IS NULL OR condicao_reprodutiva IN ('vazia', 'prenha'))
        `).run(maeIdValidado);
      }

      return result;
    });

    const result = transaction();

    const animal = db.prepare(`
      SELECT a.* FROM animal a JOIN lote l ON l.id = a.lote_id
      WHERE a.id = ? AND l.fazenda_id = ?
    `).get(result.lastInsertRowid, req.fazenda.id);
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
    const existing = db.prepare(`
      SELECT a.* FROM animal a JOIN lote l ON l.id = a.lote_id
      WHERE a.id = ? AND l.fazenda_id = ?
    `).get(id, req.fazenda.id);
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
      mae_id = existing.mae_id,
    } = req.body;

    const sexoValidado = validateSexo(sexo);
    const condicaoValidada = validateCondicaoReprodutiva(condicao_reprodutiva);
    const dataEntradaValidada = validateDateField(data_entrada, 'data_entrada');
    const loteIdValidado = validatePositiveInteger(lote_id, 'lote_id');
    const maeIdValidado = mae_id ? validatePositiveInteger(mae_id, 'mae_id') : null;
    const dataNascimentoValidada = data_nascimento ? validateDateField(data_nascimento, 'data_nascimento') : null;
    const idadeEstimadaValidada = idade_estimada_meses == null ? null : validatePositiveInteger(idade_estimada_meses, 'idade_estimada_meses');
    validateIdadeOuNascimento(dataNascimentoValidada, idadeEstimadaValidada);

    if (maeIdValidado === id) {
      return res.status(400).json({ erro: 'Um animal não pode ser mãe de si mesmo' });
    }

    const lote = db.prepare('SELECT id FROM lote WHERE id = ? AND fazenda_id = ?').get(loteIdValidado, req.fazenda.id);
    if (!lote) return res.status(404).json({ erro: 'lote_id não encontrado' });

    if (maeIdValidado) {
      const mae = db.prepare(`
        SELECT a.id, a.sexo FROM animal a JOIN lote l ON l.id = a.lote_id
        WHERE a.id = ? AND l.fazenda_id = ?
      `).get(maeIdValidado, req.fazenda.id);
      if (!mae) return res.status(404).json({ erro: 'Vaca/mãe não encontrada nesta fazenda' });
      if (mae.sexo !== 'femea') return res.status(400).json({ erro: 'A mãe informada deve ser uma fêmea' });
    }

    db.prepare(`
      UPDATE animal SET
        id_brinco = ?, raca = ?, sexo = ?, data_nascimento = ?,
        idade_estimada_meses = ?, condicao_reprodutiva = ?,
        data_entrada = ?, lote_id = ?, mae_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      id_brinco, raca, sexoValidado, dataNascimentoValidada, idadeEstimadaValidada,
      condicaoValidada, dataEntradaValidada, loteIdValidado, maeIdValidado, id
    );

    const animal = db.prepare(`
      SELECT a.* FROM animal a JOIN lote l ON l.id = a.lote_id
      WHERE a.id = ? AND l.fazenda_id = ?
    `).get(id, req.fazenda.id);
    res.json({
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

router.post('/:id/vincular-cria', (req, res, next) => {
  try {
    const maeId = validatePositiveInteger(req.params.id, 'id');
    const criaId = validatePositiveInteger(req.body.cria_id, 'cria_id');

    const mae = db.prepare(`
      SELECT a.* FROM animal a JOIN lote l ON l.id = a.lote_id
      WHERE a.id = ? AND l.fazenda_id = ?
    `).get(maeId, req.fazenda.id);
    if (!mae) return res.status(404).json({ erro: 'Vaca não encontrada' });
    if (mae.sexo !== 'femea') return res.status(400).json({ erro: 'Apenas fêmeas podem ser associadas como mãe' });

    const cria = db.prepare(`
      SELECT a.* FROM animal a JOIN lote l ON l.id = a.lote_id
      WHERE a.id = ? AND l.fazenda_id = ?
    `).get(criaId, req.fazenda.id);
    if (!cria) return res.status(404).json({ erro: 'Bezerro(a) não encontrado(a)' });
    if (cria.id === mae.id) return res.status(400).json({ erro: 'Um animal não pode ser cria de si mesmo' });

    db.transaction(() => {
      db.prepare(`
        UPDATE animal SET mae_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(maeId, criaId);

      db.prepare(`
        UPDATE animal SET condicao_reprodutiva = 'com_cria_ao_pe', updated_at = datetime('now')
        WHERE id = ?
      `).run(maeId);
    })();

    res.json({ mensagem: 'Cria associada com sucesso à vaca', mae_id: maeId, cria_id: criaId });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ erro: err.message });
    }
    next(err);
  }
});

module.exports = router;
