/**
 * Rate Limiting simples em memória
 * Limita o número de requisições por IP em uma janela de tempo
 */

function rateLimit({ windowMs = 60 * 1000, max = 100 } = {}) {
  const hits = new Map();

  // Limpeza periódica para evitar vazamento de memória
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now - entry.start > windowMs) {
        hits.delete(key);
      }
    }
  }, windowMs);

  // Não manter o processo vivo apenas por causa do timer
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = hits.get(ip);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      hits.set(ip, entry);
    }

    entry.count++;

    if (entry.count > max) {
      return res.status(429).json({
        erro: 'Muitas requisições. Tente novamente mais tarde.'
      });
    }

    next();
  };
}

module.exports = rateLimit;