const { db } = require('../db/database');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1x ao dia

let cache = {
  preco: null,
  fonte: null,
  dataReferencia: null,
  fetchedAt: null,
};

function getLatestFromDb() {
  return db
    .prepare('SELECT preco, fonte, data_referencia, created_at FROM cotacao_arroba ORDER BY id DESC LIMIT 1')
    .get();
}

function isCacheValid() {
  if (!cache.fetchedAt || cache.preco == null) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

async function fetchFromExternalSource() {
  // Ponto de extensão: integrar CEPEA, API acadêmica ou agregador agro.
  // Por enquanto retorna null — fallback para valor manual no banco.
  return null;
}

async function getPrecoArroba() {
  if (isCacheValid()) {
    return {
      preco: cache.preco,
      fonte: cache.fonte,
      data_referencia: cache.dataReferencia,
      cacheado: true,
    };
  }

  const externo = await fetchFromExternalSource();
  if (externo) {
    cache = {
      preco: externo.preco,
      fonte: externo.fonte,
      dataReferencia: externo.data_referencia,
      fetchedAt: Date.now(),
    };
    return { ...externo, cacheado: false };
  }

  const dbRow = getLatestFromDb();
  if (dbRow) {
    cache = {
      preco: dbRow.preco,
      fonte: dbRow.fonte,
      dataReferencia: dbRow.data_referencia,
      fetchedAt: Date.now(),
    };
    return {
      preco: dbRow.preco,
      fonte: dbRow.fonte,
      data_referencia: dbRow.data_referencia,
      cacheado: true,
      ultima_atualizacao: dbRow.created_at,
    };
  }

  return {
    preco: null,
    fonte: 'indisponivel',
    data_referencia: null,
    mensagem: 'Nenhuma cotação cadastrada. Informe o valor manualmente.',
  };
}

function setPrecoManual(preco, dataReferencia) {
  const fonte = 'manual';
  const data = dataReferencia || new Date().toISOString().split('T')[0];

  db.prepare('INSERT INTO cotacao_arroba (preco, fonte, data_referencia) VALUES (?, ?, ?)').run(
    preco,
    fonte,
    data
  );

  cache = {
    preco,
    fonte,
    dataReferencia: data,
    fetchedAt: Date.now(),
  };

  return { preco, fonte, data_referencia: data };
}

function invalidateCache() {
  cache = { preco: null, fonte: null, dataReferencia: null, fetchedAt: null };
}

module.exports = {
  getPrecoArroba,
  setPrecoManual,
  invalidateCache,
  CACHE_TTL_MS,
};
