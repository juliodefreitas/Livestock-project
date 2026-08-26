const { db } = require('../db/database');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos de cache

const cacheByFarm = new Map();

function getLatestFromDb(fazendaId) {
  return db
    .prepare('SELECT preco, fonte, data_referencia, created_at FROM cotacao_arroba WHERE fazenda_id = ? ORDER BY id DESC LIMIT 1')
    .get(fazendaId);
}

function isCacheValid(cache) {
  if (!cache.fetchedAt || cache.preco == null) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

async function fetchFromExternalSource() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('https://agrodocai.com.br/api/v1/cotacao', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'PecuariaSmart/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    const preco = Number(data?.boi_gordo_cepea_sp);
    if (!Number.isFinite(preco) || preco <= 0) return null;

    const dataReferencia = data.atualizado ? data.atualizado.split('T')[0] : new Date().toISOString().split('T')[0];
    const fonte = data.fonte ? `CEPEA/Esalq (${data.fonte.split('·')[0].trim()})` : 'CEPEA/Esalq SP';

    return {
      preco,
      fonte,
      data_referencia: dataReferencia,
      vaca_gorda: data.vaca_gorda || null,
      bezerro: data.bezerro_ms || null,
    };
  } catch {
    return null;
  }
}

async function getPrecoArroba(fazendaId, forceRefresh = false) {
  const cache = cacheByFarm.get(fazendaId) || {};
  if (!forceRefresh && isCacheValid(cache)) {
    return {
      preco: cache.preco,
      fonte: cache.fonte,
      data_referencia: cache.dataReferencia,
      cacheado: true,
      vaca_gorda: cache.vaca_gorda,
      bezerro: cache.bezerro,
    };
  }

  // 1. Tenta buscar da API pública em tempo real
  const externo = await fetchFromExternalSource();
  if (externo) {
    try {
      db.prepare('INSERT INTO cotacao_arroba (preco, fonte, data_referencia, fazenda_id) VALUES (?, ?, ?, ?)').run(
        externo.preco,
        externo.fonte,
        externo.data_referencia,
        fazendaId
      );
    } catch {}

    cacheByFarm.set(fazendaId, {
      preco: externo.preco,
      fonte: externo.fonte,
      dataReferencia: externo.data_referencia,
      vaca_gorda: externo.vaca_gorda,
      bezerro: externo.bezerro,
      fetchedAt: Date.now(),
    });
    return { ...externo, cacheado: false };
  }

  // 2. Fallback para a última cotação registrada no banco
  const dbRow = getLatestFromDb(fazendaId);
  if (dbRow) {
    cacheByFarm.set(fazendaId, {
      preco: dbRow.preco,
      fonte: dbRow.fonte,
      dataReferencia: dbRow.data_referencia,
      fetchedAt: Date.now(),
    });
    return {
      preco: dbRow.preco,
      fonte: dbRow.fonte,
      data_referencia: dbRow.data_referencia,
      cacheado: true,
      ultima_atualizacao: dbRow.created_at,
    };
  }

  // 3. Fallback seguro padrão
  const precoPadrao = 340.00;
  const fontePadrao = 'CEPEA/Esalq SP (Referência)';
  const dataHoje = new Date().toISOString().split('T')[0];

  cacheByFarm.set(fazendaId, {
    preco: precoPadrao,
    fonte: fontePadrao,
    dataReferencia: dataHoje,
    fetchedAt: Date.now(),
  });

  return {
    preco: precoPadrao,
    fonte: fontePadrao,
    data_referencia: dataHoje,
    cacheado: false,
    mensagem: 'Cotação de referência padrão aplicada.',
  };
}

function setPrecoManual(preco, dataReferencia, fazendaId) {
  const fonte = 'manual';
  const data = dataReferencia || new Date().toISOString().split('T')[0];

  db.prepare('INSERT INTO cotacao_arroba (preco, fonte, data_referencia, fazenda_id) VALUES (?, ?, ?, ?)').run(
    preco,
    fonte,
    data,
    fazendaId,
  );

  cacheByFarm.set(fazendaId, {
    preco,
    fonte,
    dataReferencia: data,
    fetchedAt: Date.now(),
  });

  return { preco, fonte, data_referencia: data };
}

function invalidateCache() {
  cacheByFarm.clear();
}

module.exports = {
  getPrecoArroba,
  setPrecoManual,
  invalidateCache,
  fetchFromExternalSource,
  CACHE_TTL_MS,
};
