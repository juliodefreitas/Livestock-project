const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { kgParaArrobas } = require('../services/calculationService');
const { ValidationError, validatePesoKg, validateDateField, validatePositiveInteger, validateOrigemPesagem, ensureRecordExists } = require('../utils/validation');

function normalizePesagemPayload(payload = {}) {
  const { animal_id, peso_kg, data_pesagem, origem } = payload;

  return {
    animal_id,
    peso_kg,
    data_pesagem: data_pesagem || new Date().toISOString().split('T')[0],
    origem: origem || 'manual',
  };
}

router.post('/', (req, res, next) => {
  try {
    const payload = normalizePesagemPayload(req.body);
    const { animal_id, peso_kg, data_pesagem, origem } = payload;

    const animalIdValidado = validatePositiveInteger(animal_id, 'animal_id');
    const pesoValidado = validatePesoKg(peso_kg);
    const dataPesagemValidada = validateDateField(data_pesagem, 'data_pesagem');
    const origemValidada = validateOrigemPesagem(origem);

    const animal = db.prepare(`
      SELECT a.id FROM animal a JOIN lote l ON l.id = a.lote_id
      WHERE a.id = ? AND l.fazenda_id = ?
    `).get(animalIdValidado, req.fazenda.id);
    if (!animal) return res.status(404).json({ erro: 'animal_id não encontrado' });

    const result = db
      .prepare('INSERT INTO pesagem (animal_id, peso_kg, data_pesagem, origem) VALUES (?, ?, ?, ?)')
      .run(animalIdValidado, pesoValidado, dataPesagemValidada, origemValidada);

    const pesagem = db.prepare('SELECT * FROM pesagem WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...pesagem,
      peso_arrobas: kgParaArrobas(pesagem.peso_kg),
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

router.get('/animal/:animalId', (req, res) => {
  try {
    const pesagens = db
      .prepare(`
        SELECT p.* FROM pesagem p
        JOIN animal a ON a.id = p.animal_id JOIN lote l ON l.id = a.lote_id
        WHERE p.animal_id = ? AND l.fazenda_id = ? ORDER BY p.data_pesagem ASC
      `)
      .all(parseInt(req.params.animalId, 10), req.fazenda.id);

    res.json(
      pesagens.map((p) => ({
        ...p,
        peso_arrobas: kgParaArrobas(p.peso_kg),
      }))
    );
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/lote/:loteId', (req, res) => {
  try {
    const loteId = parseInt(req.params.loteId, 10);
    const animais = db.prepare(`
      SELECT a.id FROM animal a JOIN lote l ON l.id = a.lote_id
      WHERE a.lote_id = ? AND l.fazenda_id = ?
    `).all(loteId, req.fazenda.id);
    if (!animais.length) return res.json([]);

    const placeholders = animais.map(() => '?').join(',');
    const pesagens = db
      .prepare(`SELECT p.*, a.id_brinco FROM pesagem p JOIN animal a ON a.id = p.animal_id WHERE p.animal_id IN (${placeholders}) ORDER BY p.data_pesagem ASC`)
      .all(...animais.map(a => a.id));

    res.json(pesagens.map((p) => ({ ...p, peso_arrobas: kgParaArrobas(p.peso_kg) })));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
module.exports.normalizePesagemPayload = normalizePesagemPayload;
