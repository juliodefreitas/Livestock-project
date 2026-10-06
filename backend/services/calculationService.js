const ARROBA_KG = 15;

const CATEGORIAS_POR_CABECA = new Set(['Bezerro', 'Bezerra']);

function isCotacaoPorCabeca(categoria) {
  if (!categoria) return false;
  return CATEGORIAS_POR_CABECA.has(categoria);
}

function kgParaArrobas(pesoKg) {
  if (pesoKg == null || pesoKg <= 0) return null;
  return Math.round((pesoKg / ARROBA_KG) * 100) / 100;
}

function podeVenderMatadouro(sexo, pesoArrobas) {
  if (!sexo || pesoArrobas == null) return null;
  if (sexo === 'femea') {
    return pesoArrobas >= 14;
  }
  if (sexo === 'macho') {
    return pesoArrobas >= 16;
  }
  return null;
}

function calcularIdadeMeses(dataNascimento, idadeEstimadaMeses, dataReferencia = new Date()) {
  if (dataNascimento) {
    const nasc = new Date(dataNascimento);
    const ref = new Date(dataReferencia);
    const diffMs = ref - nasc;
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  }
  return idadeEstimadaMeses ?? null;
}

function calcularValorEstimado(pesoArrobas, precoUnitario, categoria = null) {
  if (precoUnitario == null || precoUnitario <= 0) return null;

  // Cotação por cabeça (animal): o valor estimado é diretamente o preço da unidade
  if (isCotacaoPorCabeca(categoria)) {
    return Math.round(precoUnitario * 100) / 100;
  }

  // Cotação por arroba: depende do peso em arrobas
  if (pesoArrobas == null || pesoArrobas <= 0) return null;
  return Math.round(pesoArrobas * precoUnitario * 100) / 100;
}

function calcularGMD(pesagens) {
  if (!pesagens || pesagens.length < 2) return null;

  const ordenadas = [...pesagens].sort(
    (a, b) => new Date(a.data_pesagem) - new Date(b.data_pesagem)
  );

  const primeira = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  const dias = (new Date(ultima.data_pesagem) - new Date(primeira.data_pesagem)) / (1000 * 60 * 60 * 24);

  if (dias <= 0) return null;

  const ganho = ultima.peso_kg - primeira.peso_kg;
  return Math.round((ganho / dias) * 1000) / 1000;
}

function precoPorCategoria(cotacao, categoria) {
  if (cotacao?.categorias && categoria && cotacao.categorias[categoria]?.preco) {
    return cotacao.categorias[categoria].preco;
  }
  if (isCotacaoPorCabeca(categoria)) {
    return categoria === 'Bezerro' ? 2450.0 : 2150.0;
  }
  return cotacao?.preco || 340.0;
}

function enriquecerAnimal(animal, ultimaPesagem, precoUnitario, categoria, extras = {}) {
  const idadeMeses = calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses);
  const pesoKg = ultimaPesagem?.peso_kg ?? null;
  const pesoArrobas = kgParaArrobas(pesoKg);
  const porCabeca = isCotacaoPorCabeca(categoria);

  return {
    ...animal,
    idade_meses: idadeMeses,
    peso_atual_kg: pesoKg,
    peso_atual_arrobas: pesoArrobas,
    pode_vender_matadouro: podeVenderMatadouro(animal.sexo, pesoArrobas),
    preco_arroba_aplicado: porCabeca ? null : precoUnitario,
    preco_unitario_aplicado: precoUnitario,
    unidade_cotacao: porCabeca ? 'cab' : '@',
    valor_estimado: calcularValorEstimado(pesoArrobas, precoUnitario, categoria),
    categoria: categoria ?? null,
    ultima_pesagem: ultimaPesagem?.data_pesagem ?? null,
    ...extras,
  };
}

module.exports = {
  ARROBA_KG,
  CATEGORIAS_POR_CABECA,
  isCotacaoPorCabeca,
  kgParaArrobas,
  calcularIdadeMeses,
  calcularValorEstimado,
  calcularGMD,
  enriquecerAnimal,
  podeVenderMatadouro,
  precoPorCategoria,
};
