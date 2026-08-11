const express = require('express');
const router = express.Router();
const priceService = require('../services/priceService');
const { getRulesMetadata } = require('../services/classificationService');
const { ValidationError, validateDateField } = require('../utils/validation');

router.get('/arroba', async (req, res) => {
  try {
    const cotacao = await priceService.getPrecoArroba();
    res.json(cotacao);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/arroba', (req, res, next) => {
  try {
    const { preco, data_referencia } = req.body;
    const precoNumerico = Number(preco);
    if (!Number.isFinite(precoNumerico) || precoNumerico <= 0) {
      return res.status(400).json({ erro: 'preco deve ser um número maior que zero' });
    }

    const dataReferenciaValidada = validateDateField(data_referencia || new Date().toISOString().split('T')[0], 'data_referencia');
    const result = priceService.setPrecoManual(precoNumerico, dataReferenciaValidada);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ erro: err.message });
    }
    next(err);
  }
});

router.get('/classificacao', (req, res) => {
  try {
    res.json(getRulesMetadata());
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
