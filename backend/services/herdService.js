const { db } = require('../db/database');
const { calcularIdadeMeses, kgParaArrobas, calcularValorEstimado, calcularGMD, enriquecerAnimal, precoPorCategoria } = require('./calculationService');
const { classificarAnimal } = require('./classificationService');
const priceService = require('./priceService');

function getUltimaPesagem(animalId) {
  return db
    .prepare('SELECT * FROM pesagem WHERE animal_id = ? ORDER BY data_pesagem DESC LIMIT 1')
    .get(animalId);
}

function getPesagensAnimal(animalId) {
  return db
    .prepare('SELECT * FROM pesagem WHERE animal_id = ? ORDER BY data_pesagem ASC')
    .all(animalId);
}

function getPesagensPorAnimalIds(animalIds) {
  if (!animalIds.length) return {};
  const placeholders = animalIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT * FROM pesagem WHERE animal_id IN (${placeholders}) ORDER BY animal_id ASC, data_pesagem ASC`)
    .all(...animalIds);

  const map = {};
  for (const row of rows) {
    if (!map[row.animal_id]) map[row.animal_id] = [];
    map[row.animal_id].push(row);
  }
  return map;
}

function getUltimasPesagensPorAnimalIds(animalIds) {
  if (!animalIds.length) return {};
  const placeholders = animalIds.map(() => '?').join(',');
  const rows = db
    .prepare(`
      SELECT p.* FROM pesagem p
      INNER JOIN (
        SELECT animal_id, MAX(data_pesagem) AS max_data
        FROM pesagem
        WHERE animal_id IN (${placeholders})
        GROUP BY animal_id
      ) ult ON p.animal_id = ult.animal_id AND p.data_pesagem = ult.max_data
    `)
    .all(...animalIds);

  const map = {};
  for (const row of rows) {
    map[row.animal_id] = row;
  }
  return map;
}

function getCriasPorMaeIds(maeIds) {
  if (!maeIds.length) return {};
  const placeholders = maeIds.map(() => '?').join(',');
  const rows = db
    .prepare(`
      SELECT id, id_brinco, raca, sexo, data_nascimento, mae_id, lote_id
      FROM animal
      WHERE mae_id IN (${placeholders})
    `)
    .all(...maeIds);

  const map = {};
  for (const row of rows) {
    if (!map[row.mae_id]) map[row.mae_id] = [];
    map[row.mae_id].push(row);
  }
  return map;
}

function distribuicao(campo, itens) {
  const map = {};
  for (const item of itens) {
    const val = item[campo] || 'Não informado';
    map[val] = (map[val] || 0) + 1;
  }
  return Object.entries(map).map(([nome, quantidade]) => ({ nome, quantidade }));
}

async function getRebanho(filtros = {}, fazendaId) {
  const cotacao = await priceService.getPrecoArroba(fazendaId);
  let sql = `
    SELECT a.*, l.nome AS lote_nome,
           mae.id_brinco AS mae_brinco
    FROM animal a
    JOIN lote l ON l.id = a.lote_id
    LEFT JOIN animal mae ON mae.id = a.mae_id
    WHERE l.fazenda_id = ?
  `;
  const params = [fazendaId];

  if (filtros.lote_id) {
    sql += ' AND a.lote_id = ?';
    params.push(filtros.lote_id);
  }
  if (filtros.sexo) {
    sql += ' AND a.sexo = ?';
    params.push(filtros.sexo);
  }

  sql += ' ORDER BY a.id_brinco';

  const animais = db.prepare(sql).all(...params);
  if (!animais.length) {
    return { total: 0, cotacao, distribuicao: { raca: [], sexo: [], categoria: [] }, animais: [] };
  }

  const animalIds = animais.map(a => a.id);
  const ultimasPesagensMap = getUltimasPesagensPorAnimalIds(animalIds);
  const todasPesagensMap = getPesagensPorAnimalIds(animalIds);
  const criasMap = getCriasPorMaeIds(animalIds);

  const enriquecidos = animais.map(animal => {
    const ultimaPesagem = ultimasPesagensMap[animal.id] || null;
    const pesagens = todasPesagensMap[animal.id] || [];
    const crias = criasMap[animal.id] || [];
    const idadeMeses = calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses);
    const pesoArrobas = kgParaArrobas(ultimaPesagem?.peso_kg);
    const { categoria } = classificarAnimal({
      sexo: animal.sexo,
      idadeMeses,
      condicaoReprodutiva: animal.condicao_reprodutiva,
      pesoArrobas,
    });

    const precoArroba = precoPorCategoria(cotacao, categoria);
    return enriquecerAnimal(animal, ultimaPesagem, precoArroba, categoria, {
      pesagens_count: pesagens.length,
      crias: crias.map((c) => ({ id: c.id, id_brinco: c.id_brinco, raca: c.raca, sexo: c.sexo, lote_id: c.lote_id })),
      cria_ao_pe: crias.length > 0 ? crias[0] : null,
    });
  });

  return {
    total: enriquecidos.length,
    cotacao,
    distribuicao: {
      raca: distribuicao('raca', enriquecidos),
      sexo: distribuicao('sexo', enriquecidos),
      categoria: distribuicao('categoria', enriquecidos),
    },
    animais: enriquecidos,
  };
}

async function getLoteAgregado(loteId, fazendaId) {
  const lote = db.prepare('SELECT * FROM lote WHERE id = ? AND fazenda_id = ?').get(loteId, fazendaId);
  if (!lote) return null;

  const cotacao = await priceService.getPrecoArroba(fazendaId);
  const animais = db
    .prepare(`
      SELECT a.*, mae.id_brinco AS mae_brinco
      FROM animal a
      LEFT JOIN animal mae ON mae.id = a.mae_id
      WHERE a.lote_id = ? ORDER BY a.id_brinco
    `)
    .all(loteId);

  if (!animais.length) {
    return {
      lote,
      cotacao,
      resumo: {
        total_animais: 0,
        peso_medio_kg: null,
        peso_medio_arrobas: null,
        gmd_medio: null,
        valor_estimado_total: 0,
      },
      distribuicao: { raca: [], sexo: [], categoria: [] },
      animais: [],
    };
  }

  const animalIds = animais.map(a => a.id);
  const ultimasPesagensMap = getUltimasPesagensPorAnimalIds(animalIds);
  const todasPesagensMap = getPesagensPorAnimalIds(animalIds);
  const criasMap = getCriasPorMaeIds(animalIds);

  const enriquecidos = [];
  let somaPesoKg = 0;
  let somaPesoArrobas = 0;
  let somaValor = 0;
  let countComPeso = 0;
  const gmds = [];

  for (const animal of animais) {
    const ultimaPesagem = ultimasPesagensMap[animal.id] || null;
    const pesagens = todasPesagensMap[animal.id] || [];
    const crias = criasMap[animal.id] || [];
    const idadeMeses = calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses);
    const pesoArrobas = kgParaArrobas(ultimaPesagem?.peso_kg);
    const { categoria } = classificarAnimal({
      sexo: animal.sexo,
      idadeMeses,
      condicaoReprodutiva: animal.condicao_reprodutiva,
      pesoArrobas,
    });

    const precoArroba = precoPorCategoria(cotacao, categoria);
    const enriched = enriquecerAnimal(animal, ultimaPesagem, precoArroba, categoria, {
      crias: crias.map((c) => ({ id: c.id, id_brinco: c.id_brinco, raca: c.raca, sexo: c.sexo, lote_id: c.lote_id })),
      cria_ao_pe: crias.length > 0 ? crias[0] : null,
    });
    enriquecidos.push(enriched);

    if (ultimaPesagem) {
      somaPesoKg += ultimaPesagem.peso_kg;
      somaPesoArrobas += pesoArrobas || 0;
      somaValor += enriched.valor_estimado || 0;
      countComPeso++;
    }

    const gmd = calcularGMD(pesagens);
    if (gmd != null) gmds.push(gmd);
  }

  const gmdMedio = gmds.length
    ? Math.round((gmds.reduce((a, b) => a + b, 0) / gmds.length) * 1000) / 1000
    : null;

  return {
    lote,
    cotacao,
    resumo: {
      total_animais: animais.length,
      peso_medio_kg: countComPeso ? Math.round((somaPesoKg / countComPeso) * 100) / 100 : null,
      peso_medio_arrobas: countComPeso ? Math.round((somaPesoArrobas / countComPeso) * 100) / 100 : null,
      gmd_medio: gmdMedio,
      valor_estimado_total: Math.round(somaValor * 100) / 100,
    },
    distribuicao: {
      raca: distribuicao('raca', enriquecidos),
      sexo: distribuicao('sexo', enriquecidos),
      categoria: distribuicao('categoria', enriquecidos),
    },
    animais: enriquecidos,
  };
}

async function getAnimalFicha(animalId, fazendaId) {
  const animal = db
    .prepare(`
      SELECT a.*, l.nome AS lote_nome, l.id AS lote_id_ref,
             mae.id_brinco AS mae_brinco, mae.raca AS mae_raca
      FROM animal a
      JOIN lote l ON l.id = a.lote_id
      LEFT JOIN animal mae ON mae.id = a.mae_id
      WHERE a.id = ? AND l.fazenda_id = ?
    `)
    .get(animalId, fazendaId);

  if (!animal) return null;

  const crias = db.prepare(`
    SELECT id, id_brinco, raca, sexo, data_nascimento, data_entrada, lote_id
    FROM animal
    WHERE mae_id = ?
  `).all(animalId);

  const cotacao = await priceService.getPrecoArroba(fazendaId);
  const pesagens = getPesagensAnimal(animalId);
  const ultimaPesagem = pesagens.length ? pesagens[pesagens.length - 1] : null;
  const idadeMeses = calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses);
  const pesoArrobas = kgParaArrobas(ultimaPesagem?.peso_kg);
  const classificacao = classificarAnimal({
    sexo: animal.sexo,
    idadeMeses,
    condicaoReprodutiva: animal.condicao_reprodutiva,
    pesoArrobas,
  });

  const precoArroba = precoPorCategoria(cotacao, classificacao.categoria);
  const historicoPeso = pesagens.map((p) => ({
    data: p.data_pesagem,
    peso_kg: p.peso_kg,
    peso_arrobas: kgParaArrobas(p.peso_kg),
  }));

  return {
    ...enriquecerAnimal(animal, ultimaPesagem, precoArroba, classificacao.categoria, {
      crias,
      cria_ao_pe: crias.length > 0 ? crias[0] : null,
      mae: animal.mae_id ? { id: animal.mae_id, id_brinco: animal.mae_brinco, raca: animal.mae_raca } : null,
    }),
    classificacao,
    gmd: calcularGMD(pesagens),
    historico_peso: historicoPeso,
    cotacao,
    preco_arroba_aplicado: precoArroba,
    aviso_arroba: 'Peso em arrobas (@) calculado com base em peso vivo (1 @ = 15 kg). Distinto da arroba de carcaça.',
  };
}

module.exports = {
  getRebanho,
  getLoteAgregado,
  getAnimalFicha,
  getUltimaPesagem,
  getPesagensAnimal,
};
