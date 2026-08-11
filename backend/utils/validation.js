const VALID_SEXOS = new Set(['macho', 'femea']);
const VALID_CONDICOES = new Set(['inteiro', 'castrado', 'vazia', 'prenha', 'com_cria_ao_pe']);
const MAX_PESO_KG = 1200;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

function validateSexo(value) {
  if (typeof value !== 'string' || !VALID_SEXOS.has(value)) {
    throw new ValidationError('sexo deve ser "macho" ou "femea"');
  }
  return value;
}

function validateCondicaoReprodutiva(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !VALID_CONDICOES.has(value)) {
    throw new ValidationError('condicao_reprodutiva deve ser null ou um valor válido');
  }
  return value;
}

function validatePesoKg(value) {
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero <= 0) {
    throw new ValidationError('peso_kg deve ser um número positivo');
  }
  if (numero > MAX_PESO_KG) {
    throw new ValidationError('peso_kg excede o limite máximo de 1200 kg');
  }
  return numero;
}

function validateDateField(value, fieldName) {
  if (value == null || value === '') {
    throw new ValidationError(`${fieldName} é obrigatório`);
  }

  const text = String(value);
  const normalized = text.includes('T') ? text.split('T')[0] : text;
  const parsed = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${fieldName} deve ser uma data válida`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed > today) {
    throw new ValidationError(`${fieldName} não pode estar no futuro`);
  }

  return normalized;
}

function validatePositiveInteger(value, fieldName) {
  if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
    throw new ValidationError(`${fieldName} deve ser um inteiro positivo`);
  }
  return Number(value);
}

function ensureRecordExists(db, tableName, id, fieldName) {
  const record = db.prepare(`SELECT id FROM ${tableName} WHERE id = ?`).get(id);
  if (!record) {
    throw new Error(`${fieldName} não encontrado`);
  }
}

module.exports = {
  VALID_SEXOS,
  VALID_CONDICOES,
  MAX_PESO_KG,
  ValidationError,
  validateSexo,
  validateCondicaoReprodutiva,
  validatePesoKg,
  validateDateField,
  validatePositiveInteger,
  ensureRecordExists,
};
