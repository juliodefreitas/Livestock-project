const { db } = require('../db/database');
const { calcularIdadeMeses, kgParaArrobas, calcularValorEstimado, calcularGMD, enriquecerAnimal } = require('./calculationService');
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

async function enriquecerAnimalCompleto(animal) {
  const cotacao = await priceService.getPrecoArroba();
  const ultimaPesagem = getUltimaPesagem(animal.id);
  const idadeMeses = calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses);
  const pesoArrobas = kgParaArrobas(ultimaPesagem?.peso_kg);

  const { categoria, estimativa, aviso } = classificarAnimal({
    sexo: animal.sexo,
    idadeMeses,
    condicaoReprodutiva: animal.condicao_reprodutiva,
    pesoArrobas,
  });

  return enriquecerAnimal(animal, ultimaPesagem, cotacao.preco, categoria, { estimativa, aviso_classificacao: aviso });
}

function distribuicao(campo, itens) {
  const map = {};
  for (const item of itens) {
    const val = item[campo] || 'Não informado';
    map[val] = (map[val] || 0) + 1;
  }
  return Object.entries(map).map(([nome, quantidade]) => ({ nome, quantidade }));
}

async function getRebanho(filtros = {}) {
  const cotacao = await priceService.getPrecoArroba();
  let sql = `
    SELECT a.*, l.nome AS lote_nome
    FROM animal a
    JOIN lote l ON l.id = a.lote_id
    WHERE 1=1
  `;
  const params = [];

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
  const enriquecidos = [];

  for (const animal of animais) {
    const ultimaPesagem = getUltimaPesagem(animal.id);
    const idadeMeses = calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses);
    const pesoArrobas = kgParaArrobas(ultimaPesagem?.peso_kg);
    const { categoria } = classificarAnimal({
      sexo: animal.sexo,
      idadeMeses,
      condicaoReprodutiva: animal.condicao_reprodutiva,
      pesoArrobas,
    });

    enriquecidos.push(
      enriquecerAnimal(animal, ultimaPesagem, cotacao.preco, categoria)
    );
  }

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

async function getLoteAgregado(loteId) {
  const lote = db.prepare('SELECT * FROM lote WHERE id = ?').get(loteId);
  if (!lote) return null;

  const cotacao = await priceService.getPrecoArroba();
  const animais = db
    .prepare('SELECT * FROM animal WHERE lote_id = ? ORDER BY id_brinco')
    .all(loteId);

  const enriquecidos = [];
  let somaPesoKg = 0;
  let somaPesoArrobas = 0;
  let somaValor = 0;
  let countComPeso = 0;
  const gmds = [];

  for (const animal of animais) {
    const ultimaPesagem = getUltimaPesagem(animal.id);
    const pesagens = getPesagensAnimal(animal.id);
    const idadeMeses = calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses);
    const pesoArrobas = kgParaArrobas(ultimaPesagem?.peso_kg);
    const { categoria } = classificarAnimal({
      sexo: animal.sexo,
      idadeMeses,
      condicaoReprodutiva: animal.condicao_reprodutiva,
      pesoArrobas,
    });

    const enriched = enriquecerAnimal(animal, ultimaPesagem, cotacao.preco, categoria);
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

async function getAnimalFicha(animalId) {
  const animal = db
    .prepare(`
      SELECT a.*, l.nome AS lote_nome, l.id AS lote_id_ref
      FROM animal a
      JOIN lote l ON l.id = a.lote_id
      WHERE a.id = ?
    `)
    .get(animalId);

  if (!animal) return null;

  const cotacao = await priceService.getPrecoArroba();
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

  const historicoPeso = pesagens.map((p) => ({
    data: p.data_pesagem,
    peso_kg: p.peso_kg,
    peso_arrobas: kgParaArrobas(p.peso_kg),
  }));

  return {
    ...enriquecerAnimal(animal, ultimaPesagem, cotacao.preco, classificacao.categoria),
    classificacao,
    gmd: calcularGMD(pesagens),
    historico_peso: historicoPeso,
    cotacao,
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
