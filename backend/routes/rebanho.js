const express = require('express');
const router = express.Router();
const herdService = require('../services/herdService');

router.get('/', async (req, res, next) => {
  try {
    const filtros = {
      lote_id: req.query.lote_id ? parseInt(req.query.lote_id, 10) : undefined,
      sexo: req.query.sexo,
    };
    const data = await herdService.getRebanho(filtros);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
