const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularIdadeMeses, kgParaArrobas, calcularValorEstimado, calcularGMD, podeVenderMatadouro } = require('../calculationService');

test('calcularIdadeMeses usa data de nascimento quando disponível', () => {
  const idade = calcularIdadeMeses('2023-01-01', null, '2024-01-01');
  assert.equal(idade, 11);
});

test('calcularIdadeMeses usa idade estimada quando não há data de nascimento', () => {
  const idade = calcularIdadeMeses(null, 18, '2024-01-01');
  assert.equal(idade, 18);
});

test('calcularIdadeMeses retorna 0 para data futura', () => {
  const idade = calcularIdadeMeses('2030-01-01', null, '2024-01-01');
  assert.equal(idade, 0);
});

test('calcularIdadeMeses retorna null sem dados', () => {
  assert.equal(calcularIdadeMeses(null, null, '2024-01-01'), null);
});

test('kgParaArrobas converte valores válidos e trata entradas inválidas', () => {
  assert.equal(kgParaArrobas(30), 2); // 30 / 15
  assert.equal(kgParaArrobas(45), 3);
  assert.equal(kgParaArrobas(null), null);
  assert.equal(kgParaArrobas(0), null);
  assert.equal(kgParaArrobas(-5), null);
});

test('calcularValorEstimado arredonda o valor estimado', () => {
  assert.equal(calcularValorEstimado(2.6667, 285.5), 761.34);
  assert.equal(calcularValorEstimado(null, 285.5), null);
});

test('podeVenderMatadouro retorna false para fêmeas com menos de 14 arrobas', () => {
  assert.equal(podeVenderMatadouro('femea', 13.9), false);
});

test('podeVenderMatadouro retorna true para fêmeas com 14 arrobas ou mais', () => {
  assert.equal(podeVenderMatadouro('femea', 14), true);
});

test('podeVenderMatadouro retorna false para machos com menos de 16 arrobas', () => {
  assert.equal(podeVenderMatadouro('macho', 15.9), false);
});

test('podeVenderMatadouro retorna true para machos com 16 arrobas ou mais', () => {
  assert.equal(podeVenderMatadouro('macho', 16), true);
});

test('calcularGMD considera pesagens ordenadas e ignora datas inválidas', () => {
  const gmd = calcularGMD([
    { data_pesagem: '2024-01-01', peso_kg: 300 },
    { data_pesagem: '2024-02-01', peso_kg: 330 },
  ]);
  assert.equal(gmd, 0.968);
});

test('calcularGMD retorna null para uma única pesagem', () => {
  assert.equal(calcularGMD([{ data_pesagem: '2024-01-01', peso_kg: 300 }]), null);
});

test('calcularGMD respeita ordem cronológica das pesagens', () => {
  const gmd = calcularGMD([
    { data_pesagem: '2024-02-01', peso_kg: 330 },
    { data_pesagem: '2024-01-01', peso_kg: 300 },
  ]);
  assert.equal(gmd, 0.968);
});

test('calcularGMD retorna null para mesma data', () => {
  assert.equal(calcularGMD([
    { data_pesagem: '2024-01-01', peso_kg: 300 },
    { data_pesagem: '2024-01-01', peso_kg: 330 },
  ]), null);
});
