const ARROBA_KG = 15;

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

function calcularValorEstimado(pesoArrobas, precoArroba) {
  if (pesoArrobas == null || precoArroba == null) return null;
  return Math.round(pesoArrobas * precoArroba * 100) / 100;
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

function enriquecerAnimal(animal, ultimaPesagem, precoArroba, categoria, extras = {}) {
  const idadeMeses = calcularIdadeMeses(animal.data_nascimento, animal.idade_estimada_meses);
  const pesoKg = ultimaPesagem?.peso_kg ?? null;
  const pesoArrobas = kgParaArrobas(pesoKg);

  return {
    ...animal,
    idade_meses: idadeMeses,
    peso_atual_kg: pesoKg,
    peso_atual_arrobas: pesoArrobas,
    pode_vender_matadouro: podeVenderMatadouro(animal.sexo, pesoArrobas),
    valor_estimado: calcularValorEstimado(pesoArrobas, precoArroba),
    categoria: categoria ?? null,
    ultima_pesagem: ultimaPesagem?.data_pesagem ?? null,
    ...extras,
  };
}

module.exports = {
  ARROBA_KG,
  kgParaArrobas,
  calcularIdadeMeses,
  calcularValorEstimado,
  calcularGMD,
  enriquecerAnimal,
  podeVenderMatadouro,
};
