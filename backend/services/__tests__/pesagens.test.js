const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePesagemPayload } = require('../../routes/pesagens');

test('normalizePesagemPayload usa origem manual por padrão para cadastro manual', () => {
  const payload = normalizePesagemPayload({ animal_id: 7, peso_kg: 320, data_pesagem: '2024-01-01' });

  assert.equal(payload.animal_id, 7);
  assert.equal(payload.peso_kg, 320);
  assert.equal(payload.origem, 'manual');
});

test('normalizePesagemPayload preserva origem informada', () => {
  const payload = normalizePesagemPayload({ animal_id: 8, peso_kg: 340, data_pesagem: '2024-01-02', origem: 'balanca' });

  assert.equal(payload.origem, 'balanca');
});
