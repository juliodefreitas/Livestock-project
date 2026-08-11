const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { kgParaArrobas } = require('../services/calculationService');

router.post('/', (req, res) => {
  try {
    const { animal_id, peso_kg, data_pesagem, origem } = req.body;

    if (!animal_id || !peso_kg || peso_kg <= 0) {
      return res.status(400).json({ erro: 'animal_id e peso_kg (> 0) são obrigatórios' });
    }

    const animal = db.prepare('SELECT id FROM animal WHERE id = ?').get(animal_id);
    if (!animal) return res.status(404).json({ erro: 'Animal não encontrado' });

    const result = db
      .prepare('INSERT INTO pesagem (animal_id, peso_kg, data_pesagem, origem) VALUES (?, ?, ?, ?)')
      .run(animal_id, peso_kg, data_pesagem || new Date().toISOString(), origem || 'balanca');

    const pesagem = db.prepare('SELECT * FROM pesagem WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      ...pesagem,
      peso_arrobas: kgParaArrobas(pesagem.peso_kg),
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/animal/:animalId', (req, res) => {
  try {
    const pesagens = db
      .prepare('SELECT * FROM pesagem WHERE animal_id = ? ORDER BY data_pesagem ASC')
      .all(parseInt(req.params.animalId, 10));

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

module.exports = router;
