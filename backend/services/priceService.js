const { db } = require('../db/database');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos de cache

const cacheByFarm = new Map();

function getLatestFromDb(fazendaId) {
  return db
    .prepare('SELECT preco, fonte, data_referencia, created_at FROM cotacao_arroba WHERE fazenda_id = ? ORDER BY id DESC LIMIT 1')
    .get(fazendaId);
}

function getCategoriasFromDb(fazendaId) {
  return db
    .prepare(`
      SELECT c1.categoria, c1.preco, c1.fonte, c1.data_referencia, c1.created_at
      FROM cotacao_categoria c1
      INNER JOIN (
        SELECT categoria, MAX(id) as max_id
        FROM cotacao_categoria
        WHERE fazenda_id = ?
        GROUP BY categoria
      ) c2 ON c1.id = c2.max_id
    `)
    .all(fazendaId);
}

function isCacheValid(cache) {
  if (!cache.fetchedAt || cache.preco == null) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

// Derivação zootécnica de mercado padrão quando a API externa não fornecer cotação direta
function calcularCategoriasDerivadas(precoBoiGordo, dataRef, fonteBase, custom = {}) {
  const precoBase = Number(precoBoiGordo) || 340;
  const precoVaca = custom.vaca_gorda ? Number(custom.vaca_gorda) : Math.round(precoBase * 0.90 * 100) / 100; // ~90% do boi gordo
  const precoNovilha = Math.round(precoBase * 0.93 * 100) / 100; // ~93%
  const precoBezerro = custom.bezerro ? Number(custom.bezerro) : Math.round(precoBase * 1.18 * 100) / 100; // ~118% (ágio bezerro)
  const precoBezerra = Math.round(precoBezerro * 0.92 * 100) / 100;
  const precoGarrote = Math.round(precoBase * 1.05 * 100) / 100;
  const precoNovilho = Math.round(precoBase * 0.98 * 100) / 100;
  const precoTouro = Math.round(precoBase * 0.85 * 100) / 100;

  return {
    'Boi gordo': { preco: precoBase, fonte: fonteBase, data_referencia: dataRef },
    'Boi': { preco: precoBase, fonte: fonteBase, data_referencia: dataRef },
    'Vaca gorda': { preco: precoVaca, fonte: custom.vaca_gorda ? `${fonteBase} (Vaca Gorda)` : `${fonteBase} (Estimado)`, data_referencia: dataRef },
    'Vaca': { preco: precoVaca, fonte: custom.vaca_gorda ? `${fonteBase} (Vaca Gorda)` : `${fonteBase} (Estimado)`, data_referencia: dataRef },
    'Novilha': { preco: precoNovilha, fonte: `${fonteBase} (Estimado)`, data_referencia: dataRef },
    'Novilho': { preco: precoNovilho, fonte: `${fonteBase} (Estimado)`, data_referencia: dataRef },
    'Bezerro': { preco: precoBezerro, fonte: custom.bezerro ? `${fonteBase} (Bezerro)` : `${fonteBase} (Estimado)`, data_referencia: dataRef },
    'Bezerra': { preco: precoBezerra, fonte: `${fonteBase} (Estimado)`, data_referencia: dataRef },
    'Garrote': { preco: precoGarrote, fonte: `${fonteBase} (Estimado)`, data_referencia: dataRef },
    'Touro': { preco: precoTouro, fonte: `${fonteBase} (Estimado)`, data_referencia: dataRef },
  };
}

async function fetchFromExternalSource() {
  const sources = [
    async () => {
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
        bezerro: data.bezerro_ms || data.bezerro_sp || null,
      };
    },
    async () => {
      // Fallback para API pública de commodities / indicadores agro
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const data = await response.json();
      if (!Array.isArray(data) || !data.length) return null;
      const row = data[0];
      const preco = Number(String(row.valor).replace(',', '.'));
      if (!Number.isFinite(preco) || preco <= 0) return null;
      const [d, m, y] = (row.data || '').split('/');
      const dataReferencia = y && m && d ? `${y}-${m}-${d}` : new Date().toISOString().split('T')[0];
      return {
        preco,
        fonte: 'Banco Central / CEPEA',
        data_referencia: dataReferencia,
        vaca_gorda: null,
        bezerro: null,
      };
    }
  ];

  for (const fetcher of sources) {
    try {
      const result = await fetcher();
      if (result) return result;
    } catch {}
  }
  return null;
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
      categorias: cache.categorias || calcularCategoriasDerivadas(cache.preco, cache.dataReferencia, cache.fonte, cache),
    };
  }

  // 1. Fallback prioritário: se houver cotação manual registrada pelo produtor/usuário no banco mais recente
  const dbRow = getLatestFromDb(fazendaId);
  const dbCategorias = getCategoriasFromDb(fazendaId);

  // 2. Se não houver cache válido e nem inserção recente, tenta buscar da API pública em tempo real
  let externo = null;
  if (!dbRow || dbRow.fonte !== 'manual') {
    externo = await fetchFromExternalSource();
  }

  if (externo) {
    try {
      db.prepare('INSERT INTO cotacao_arroba (preco, fonte, data_referencia, fazenda_id) VALUES (?, ?, ?, ?)').run(
        externo.preco,
        externo.fonte,
        externo.data_referencia,
        fazendaId
      );
    } catch {}

    const categorias = calcularCategoriasDerivadas(externo.preco, externo.data_referencia, externo.fonte, externo);
    for (const cat of dbCategorias) {
      categorias[cat.categoria] = {
        preco: cat.preco,
        fonte: cat.fonte,
        data_referencia: cat.data_referencia,
      };
    }

    cacheByFarm.set(fazendaId, {
      preco: externo.preco,
      fonte: externo.fonte,
      dataReferencia: externo.data_referencia,
      vaca_gorda: externo.vaca_gorda,
      bezerro: externo.bezerro,
      categorias,
      fetchedAt: Date.now(),
    });
    return { ...externo, categorias, cacheado: false };
  }

  // 3. Fallback para a última cotação registrada no banco
  if (dbRow) {
    const categorias = calcularCategoriasDerivadas(dbRow.preco, dbRow.data_referencia, dbRow.fonte);
    for (const cat of dbCategorias) {
      categorias[cat.categoria] = {
        preco: cat.preco,
        fonte: cat.fonte,
        data_referencia: cat.data_referencia,
      };
    }

    cacheByFarm.set(fazendaId, {
      preco: dbRow.preco,
      fonte: dbRow.fonte,
      dataReferencia: dbRow.data_referencia,
      categorias,
      fetchedAt: Date.now(),
    });
    return {
      preco: dbRow.preco,
      fonte: dbRow.fonte,
      data_referencia: dbRow.data_referencia,
      categorias,
      cacheado: true,
      ultima_atualizacao: dbRow.created_at,
    };
  }

  // 3. Fallback seguro padrão
  const precoPadrao = 340.00;
  const fontePadrao = 'CEPEA/Esalq SP (Referência)';
  const dataHoje = new Date().toISOString().split('T')[0];
  const categorias = calcularCategoriasDerivadas(precoPadrao, dataHoje, fontePadrao);

  cacheByFarm.set(fazendaId, {
    preco: precoPadrao,
    fonte: fontePadrao,
    dataReferencia: dataHoje,
    categorias,
    fetchedAt: Date.now(),
  });

  return {
    preco: precoPadrao,
    fonte: fontePadrao,
    data_referencia: dataHoje,
    categorias,
    cacheado: false,
    mensagem: 'Cotação de referência padrão aplicada.',
  };
}

function setPrecoManual(preco, dataReferencia, fazendaId, categoria = null) {
  const fonte = 'manual';
  const data = dataReferencia || new Date().toISOString().split('T')[0];

  if (!categoria || categoria === 'Boi gordo' || categoria === 'geral') {
    db.prepare('INSERT INTO cotacao_arroba (preco, fonte, data_referencia, fazenda_id) VALUES (?, ?, ?, ?)').run(
      preco,
      fonte,
      data,
      fazendaId,
    );
  }

  if (categoria && categoria !== 'geral') {
    db.prepare('INSERT INTO cotacao_categoria (categoria, preco, fonte, data_referencia, fazenda_id) VALUES (?, ?, ?, ?, ?)').run(
      categoria,
      preco,
      fonte,
      data,
      fazendaId,
    );
  }

  // Invalidar cache para recalcular
  cacheByFarm.delete(fazendaId);

  return { preco, fonte, data_referencia: data, categoria: categoria || 'Boi gordo' };
}

function invalidateCache() {
  cacheByFarm.clear();
}

module.exports = {
  getPrecoArroba,
  setPrecoManual,
  invalidateCache,
  fetchFromExternalSource,
  calcularCategoriasDerivadas,
  CACHE_TTL_MS,
};
