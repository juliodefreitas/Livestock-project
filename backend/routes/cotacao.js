const express = require('express');
const router = express.Router();
const priceService = require('../services/priceService');
const { getRulesMetadata } = require('../services/classificationService');

router.get('/arroba', async (req, res) => {
  try {
    const cotacao = await priceService.getPrecoArroba();
    res.json(cotacao);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/arroba', (req, res) => {
  try {
    const { preco, data_referencia } = req.body;
    if (!preco || preco <= 0) {
      return res.status(400).json({ erro: 'Preço da arroba deve ser maior que zero' });
    }
    const result = priceService.setPrecoManual(parseFloat(preco), data_referencia);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ erro: err.message });
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
