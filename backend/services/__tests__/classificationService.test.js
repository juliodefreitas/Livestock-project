const test = require('node:test');
const assert = require('node:assert/strict');
const { classificarAnimal } = require('../classificationService');

test('classificarAnimal usa a primeira regra compatível', () => {
  const resultado = classificarAnimal({
    sexo: 'macho',
    idadeMeses: 10,
    condicaoReprodutiva: null,
    pesoArrobas: 4,
  });
  assert.equal(resultado.categoria, 'Bezerro');
});

test('classificarAnimal reconhece outra regra real de classificação', () => {
  const resultado = classificarAnimal({
    sexo: 'femea',
    idadeMeses: 18,
    condicaoReprodutiva: 'vazia',
    pesoArrobas: 8,
  });
  assert.equal(resultado.categoria, 'Novilha');
});

test('classificarAnimal respeita a ordem das regras quando duas podem combinar', () => {
  const resultado = classificarAnimal({
    sexo: 'macho',
    idadeMeses: 30,
    condicaoReprodutiva: 'castrado',
    pesoArrobas: 18,
  });
  assert.equal(resultado.categoria, 'Novilho');
});

test('classificarAnimal retorna não classificado quando nenhuma regra corresponde', () => {
  const resultado = classificarAnimal({
    sexo: 'femea',
    idadeMeses: 40,
    condicaoReprodutiva: 'inteiro',
    pesoArrobas: 6,
  });
  assert.equal(resultado.categoria, 'Não classificado');
});
