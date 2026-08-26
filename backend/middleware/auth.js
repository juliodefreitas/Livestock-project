const crypto = require('crypto');
const { db } = require('../db/database');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(fazendaId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare(`
    INSERT INTO sessao_fazenda (fazenda_id, token_hash, expires_at)
    VALUES (?, ?, datetime('now', '+12 hours'))
  `).run(fazendaId, hashToken(token));
  return token;
}

function requireAuth(req, res, next) {
  if (req.path === '/health') return next();
  const authorization = req.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) return res.status(401).json({ erro: 'Autenticação obrigatória' });

  const session = db.prepare(`
    SELECT f.id, f.cnpj, f.nome
    FROM sessao_fazenda s
    JOIN fazenda f ON f.id = s.fazenda_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND f.ativo = 1
  `).get(hashToken(token));

  if (!session) return res.status(401).json({ erro: 'Sessão inválida ou expirada' });

  req.fazenda = session;
  next();
}

module.exports = { createSession, requireAuth, hashToken };
