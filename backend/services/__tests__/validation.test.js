const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSexo, validateCondicaoReprodutiva, validatePesoKg, validateDateField, validatePositiveInteger } = require('../../utils/validation');

test('validateSexo aceita valores válidos e rejeita inválidos', () => {
  assert.equal(validateSexo('macho'), 'macho');
  assert.equal(validateSexo('femea'), 'femea');
  assert.throws(() => validateSexo('outro'), /sexo/i);
});

test('validateCondicaoReprodutiva aceita null e valores válidos', () => {
  assert.equal(validateCondicaoReprodutiva(null), null);
  assert.equal(validateCondicaoReprodutiva('prenha'), 'prenha');
  assert.throws(() => validateCondicaoReprodutiva('invalida'), /condicao/i);
});

test('validatePesoKg rejeita valores fora do limite', () => {
  assert.equal(validatePesoKg(450), 450);
  assert.throws(() => validatePesoKg(0), /positivo/i);
  assert.throws(() => validatePesoKg(1300), /1200/i);
});

test('validateDateField aceita datas válidas e rejeita futuro/erro', () => {
  assert.equal(validateDateField('2024-01-01'), '2024-01-01');
  assert.throws(() => validateDateField('2024-99-99'), /válida/i);
  assert.throws(() => validateDateField('2100-01-01'), /futuro/i);
});

test('validatePositiveInteger valida ids positivos', () => {
  assert.equal(validatePositiveInteger(7, 'animal_id'), 7);
  assert.throws(() => validatePositiveInteger(0, 'lote_id'), /positivo/i);
});
