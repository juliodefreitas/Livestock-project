const fs = require('fs');
const path = require('path');

const RULES_PATH = path.join(__dirname, '..', 'config', 'classification_rules.json');

let cachedRules = null;

function loadRules() {
  if (!cachedRules) {
    const raw = fs.readFileSync(RULES_PATH, 'utf-8');
    cachedRules = JSON.parse(raw);
  }
  return cachedRules;
}

function reloadRules() {
  cachedRules = null;
  return loadRules();
}

function matchesCondicao(regraCondicao, animalCondicao) {
  if (regraCondicao == null) return true;
  if (Array.isArray(regraCondicao)) {
    return regraCondicao.includes(animalCondicao);
  }
  return regraCondicao === animalCondicao;
}

function matchesRegra(regra, { sexo, idadeMeses, condicaoReprodutiva, pesoArrobas }) {
  if (regra.sexo && regra.sexo !== sexo) return false;
  if (!matchesCondicao(regra.condicao_reprodutiva, condicaoReprodutiva)) return false;

  if (regra.idade_min_meses != null && (idadeMeses == null || idadeMeses < regra.idade_min_meses)) {
    return false;
  }
  if (regra.idade_max_meses != null && (idadeMeses == null || idadeMeses > regra.idade_max_meses)) {
    return false;
  }
  if (regra.peso_arrobas_min != null && (pesoArrobas == null || pesoArrobas < regra.peso_arrobas_min)) {
    return false;
  }
  if (regra.peso_arrobas_max != null && (pesoArrobas == null || pesoArrobas > regra.peso_arrobas_max)) {
    return false;
  }

  return true;
}

function classificarAnimal({ sexo, idadeMeses, condicaoReprodutiva, pesoArrobas }) {
  const { categorias } = loadRules();

  for (const regra of categorias) {
    if (matchesRegra(regra, { sexo, idadeMeses, condicaoReprodutiva, pesoArrobas })) {
      return {
        categoria: regra.nome,
        estimativa: true,
        aviso: 'Classificação automática baseada em regras configuráveis — não substitui laudo técnico.',
      };
    }
  }

  return {
    categoria: 'Não classificado',
    estimativa: true,
    aviso: 'Nenhuma regra configurada corresponde a este animal.',
  };
}

function getRulesMetadata() {
  const rules = loadRules();
  return {
    meta: rules._meta,
    categorias: rules.categorias.map((c) => c.nome),
  };
}

module.exports = {
  classificarAnimal,
  loadRules,
  reloadRules,
  getRulesMetadata,
};
