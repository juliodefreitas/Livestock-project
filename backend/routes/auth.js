const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { createSession, hashToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

function normalizeCnpj(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidCnpj(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calculateDigit = (base) => {
    let factor = base.length - 7;
    const total = [...base].reduce((sum, digit) => {
      const next = sum + Number(digit) * factor;
      factor = factor === 2 ? 9 : factor - 1;
      return next;
    }, 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculateDigit(cnpj.slice(0, 12)) === Number(cnpj[12])
    && calculateDigit(cnpj.slice(0, 13)) === Number(cnpj[13]);
}

function publicFarm(fazenda) {
  return { id: fazenda.id, cnpj: fazenda.cnpj, nome: fazenda.nome };
}

router.post('/cadastro', (req, res, next) => {
  try {
    const cnpj = normalizeCnpj(req.body.cnpj);
    const nome = String(req.body.nome || '').trim();
    const senha = String(req.body.senha || '');
    if (!isValidCnpj(cnpj)) return res.status(400).json({ erro: 'CNPJ inválido' });
    if (nome.length < 2) return res.status(400).json({ erro: 'Nome da fazenda deve ter ao menos 2 caracteres' });
    if (senha.length < 8) return res.status(400).json({ erro: 'A senha deve ter ao menos 8 caracteres' });

    const cadastrar = db.transaction(() => {
      const result = db.prepare('INSERT INTO fazenda (cnpj, nome, senha_hash) VALUES (?, ?, ?)').run(
        cnpj, nome, bcrypt.hashSync(senha, 12),
      );
      const fazendaId = Number(result.lastInsertRowid);
      const hasAnotherFarm = db.prepare('SELECT COUNT(*) AS total FROM fazenda WHERE id != ?').get(fazendaId).total > 0;
      if (!hasAnotherFarm) {
        db.prepare('UPDATE lote SET fazenda_id = ? WHERE fazenda_id IS NULL').run(fazendaId);
        db.prepare('UPDATE cotacao_arroba SET fazenda_id = ? WHERE fazenda_id IS NULL').run(fazendaId);
      }
      return db.prepare('SELECT id, cnpj, nome FROM fazenda WHERE id = ?').get(fazendaId);
    });

    const fazenda = cadastrar();
    res.status(201).json({ fazenda: publicFarm(fazenda), token: createSession(fazenda.id) });
  } catch (error) {
    if (error.message.includes('UNIQUE')) return res.status(409).json({ erro: 'Já existe uma fazenda cadastrada com este CNPJ' });
    next(error);
  }
});

router.post('/login', (req, res, next) => {
  try {
    const cnpj = normalizeCnpj(req.body.cnpj);
    const senha = String(req.body.senha || '');
    const fazenda = db.prepare('SELECT * FROM fazenda WHERE cnpj = ? AND ativo = 1').get(cnpj);
    if (!fazenda || !bcrypt.compareSync(senha, fazenda.senha_hash)) {
      return res.status(401).json({ erro: 'CNPJ ou senha inválidos' });
    }
    res.json({ fazenda: publicFarm(fazenda), token: createSession(fazenda.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', requireAuth, (req, res, next) => {
  try {
    db.prepare('DELETE FROM sessao_fazenda WHERE token_hash = ?').run(hashToken(req.get('authorization').slice(7)));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ fazenda: publicFarm(req.fazenda) }));

module.exports = router;
