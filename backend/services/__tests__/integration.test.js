const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configurar banco temporário antes de importar o servidor
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pecuaria-test-'));
process.env.DB_PATH = path.join(tempDir, 'test.db');
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'http://localhost:3000';

const app = require('../../server');
const bcrypt = require('bcryptjs');
const { db } = require('../../db/database');
const { createSession } = require('../../middleware/auth');

const testFarm = db.prepare('INSERT INTO fazenda (cnpj, nome, senha_hash) VALUES (?, ?, ?)').run(
  '04252011000110',
  'Fazenda de Teste',
  bcrypt.hashSync('senha-segura-123', 4),
);
const authToken = createSession(Number(testFarm.lastInsertRowid));

function request(method, url, body, token = authToken) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1',
        port,
        path: url,
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      };

      const req = require('http').request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          server.close();
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch (e) {
            parsed = data;
          }

          resolve({ status: res.statusCode, body: parsed });
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

test('GET /api/health retorna 200', async () => {
  const res = await request('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('Autenticação protege dados e isola fazendas', async () => {
  const unauthenticated = await request('GET', '/api/lotes', null, null);
  assert.equal(unauthenticated.status, 401);

  const secretLote = await request('POST', '/api/lotes', { nome: 'Lote Privado' });
  assert.equal(secretLote.status, 201);

  const secondFarm = await request('POST', '/api/auth/cadastro', {
    cnpj: '12345678000195',
    nome: 'Outra Fazenda',
    senha: 'senha-segura-456',
  }, null);
  assert.equal(secondFarm.status, 201);

  const otherFarmLotes = await request('GET', '/api/lotes', null, secondFarm.body.token);
  assert.equal(otherFarmLotes.status, 200);
  assert.equal(otherFarmLotes.body.some((lote) => lote.nome === 'Lote Privado'), false);
});

test('Criação e listagem de lote', async () => {
  const created = await request('POST', '/api/lotes', { nome: 'Lote Teste 1', descricao: 'Teste' });
  assert.equal(created.status, 201);
  assert.equal(created.body.nome, 'Lote Teste 1');

  const list = await request('GET', '/api/lotes');
  assert.equal(list.status, 200);
  assert.ok(list.body.some((l) => l.nome === 'Lote Teste 1'));
});

test('Criação, atualização e consulta de animal', async () => {
  const lote = await request('POST', '/api/lotes', { nome: 'Lote Teste 2' });
  const loteId = lote.body.id;

  const created = await request('POST', '/api/animais', {
    id_brinco: 'BR-TEST-001',
    raca: 'Nelore',
    sexo: 'macho',
    data_nascimento: '2023-01-15',
    condicao_reprodutiva: 'castrado',
    data_entrada: '2025-01-10',
    lote_id: loteId,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.id_brinco, 'BR-TEST-001');

  const animalId = created.body.id;

  const updated = await request('PUT', `/api/animais/${animalId}`, {
    raca: 'Angus',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.raca, 'Angus');

  const fetched = await request('GET', `/api/animais/${animalId}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.id_brinco, 'BR-TEST-001');
});

test('Cadastro pode registrar a primeira pesagem e transferir o animal', async () => {
  const origem = await request('POST', '/api/lotes', { nome: 'Lote Origem' });
  const destino = await request('POST', '/api/lotes', { nome: 'Lote Destino' });
  const created = await request('POST', '/api/animais', {
    id_brinco: 'BR-PRIMEIRA-PESAGEM',
    raca: 'Nelore',
    sexo: 'macho',
    data_nascimento: '2023-01-15',
    data_entrada: '2025-01-10',
    lote_id: origem.body.id,
    peso_kg: 320,
  });

  assert.equal(created.status, 201);
  const pesagens = await request('GET', `/api/pesagens/animal/${created.body.id}`);
  assert.equal(pesagens.body.length, 1);
  assert.equal(pesagens.body[0].peso_kg, 320);

  const moved = await request('PUT', `/api/animais/${created.body.id}`, { lote_id: destino.body.id });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.lote_id, destino.body.id);
});

test('Rejeição de animal com payload inválido', async () => {
  const res = await request('POST', '/api/animais', {
    id_brinco: 'BR-TEST-002',
    raca: 'Nelore',
    sexo: 'invalido',
    data_nascimento: '2023-01-15',
    data_entrada: '2025-01-10',
    lote_id: 1,
  });
  assert.equal(res.status, 400);
});

test('Registro e consulta de pesagem manual', async () => {
  const lote = await request('POST', '/api/lotes', { nome: 'Lote Teste 3' });
  const animal = await request('POST', '/api/animais', {
    id_brinco: 'BR-TEST-003',
    raca: 'Nelore',
    sexo: 'femea',
    data_nascimento: '2022-05-10',
    data_entrada: '2025-01-10',
    lote_id: lote.body.id,
  });

  const pesagem = await request('POST', '/api/pesagens', {
    animal_id: animal.body.id,
    peso_kg: 450,
    data_pesagem: '2025-06-01',
  });
  assert.equal(pesagem.status, 201);
  assert.equal(pesagem.body.origem, 'manual');

  const historico = await request('GET', `/api/pesagens/animal/${animal.body.id}`);
  assert.equal(historico.status, 200);
  assert.equal(historico.body.length, 1);
});

test('Rejeição de peso inválido', async () => {
  const lote = await request('POST', '/api/lotes', { nome: 'Lote Teste 4' });
  const animal = await request('POST', '/api/animais', {
    id_brinco: 'BR-TEST-004',
    raca: 'Nelore',
    sexo: 'macho',
    data_nascimento: '2022-05-10',
    data_entrada: '2025-01-10',
    lote_id: lote.body.id,
  });

  const pesagem = await request('POST', '/api/pesagens', {
    animal_id: animal.body.id,
    peso_kg: 10,
    data_pesagem: '2025-06-01',
  });
  assert.equal(pesagem.status, 400);
});

test('Consulta de rebanho e filtros por lote e sexo', async () => {
  const lote = await request('POST', '/api/lotes', { nome: 'Lote Teste 5' });
  await request('POST', '/api/animais', {
    id_brinco: 'BR-TEST-005',
    raca: 'Nelore',
    sexo: 'macho',
    data_nascimento: '2022-05-10',
    data_entrada: '2025-01-10',
    lote_id: lote.body.id,
  });
  await request('POST', '/api/animais', {
    id_brinco: 'BR-TEST-006',
    raca: 'Angus',
    sexo: 'femea',
    data_nascimento: '2022-05-10',
    data_entrada: '2025-01-10',
    lote_id: lote.body.id,
  });

  const rebanho = await request('GET', '/api/rebanho');
  assert.equal(rebanho.status, 200);
  assert.ok(rebanho.body.total >= 2);

  const filtroLote = await request('GET', `/api/rebanho?lote_id=${lote.body.id}`);
  assert.equal(filtroLote.status, 200);
  assert.equal(filtroLote.body.total, 2);

  const filtroSexo = await request('GET', `/api/rebanho?sexo=macho`);
  assert.equal(filtroSexo.status, 200);
  assert.ok(filtroSexo.body.animais.every((a) => a.sexo === 'macho'));
});

test('Agregados por lote', async () => {
  const lote = await request('POST', '/api/lotes', { nome: 'Lote Teste 6' });
  const animal = await request('POST', '/api/animais', {
    id_brinco: 'BR-TEST-007',
    raca: 'Nelore',
    sexo: 'macho',
    data_nascimento: '2022-05-10',
    data_entrada: '2025-01-10',
    lote_id: lote.body.id,
  });

  await request('POST', '/api/pesagens', {
    animal_id: animal.body.id,
    peso_kg: 450,
    data_pesagem: '2025-06-01',
  });

  const agregado = await request('GET', `/api/lotes/${lote.body.id}`);
  assert.equal(agregado.status, 200);
  assert.equal(agregado.body.resumo.total_animais, 1);
  assert.equal(agregado.body.resumo.peso_medio_kg, 450);
});

test('Consulta e inserção de cotação', async () => {
  const cotacao = await request('GET', '/api/cotacao/arroba');
  assert.equal(cotacao.status, 200);

  const inserida = await request('POST', '/api/cotacao/arroba', {
    preco: 300,
    data_referencia: '2025-06-01',
  });
  assert.equal(inserida.status, 201);
  assert.equal(inserida.body.preco, 300);

  const inseridaCat = await request('POST', '/api/cotacao/arroba', {
    preco: 360,
    categoria: 'Bezerro',
    data_referencia: '2025-06-01',
  });
  assert.equal(inseridaCat.status, 201);
  assert.equal(inseridaCat.body.categoria, 'Bezerro');

  const cotacoesCat = await request('GET', '/api/cotacao/categorias');
  assert.equal(cotacoesCat.status, 200);
  assert.equal(cotacoesCat.body['Bezerro'].preco, 360);
});

test('Associação de vaca com cria no pé', async () => {
  const lote = await request('POST', '/api/lotes', { nome: 'Lote Maternidade' });
  const vaca = await request('POST', '/api/animais', {
    id_brinco: 'VACA-MATRIZ-01',
    raca: 'Nelore',
    sexo: 'femea',
    data_nascimento: '2020-01-01',
    condicao_reprodutiva: 'com_cria_ao_pe',
    data_entrada: '2025-01-01',
    lote_id: lote.body.id,
  });
  assert.equal(vaca.status, 201);

  const bezerro = await request('POST', '/api/animais', {
    id_brinco: 'BEZERRO-01',
    raca: 'Nelore',
    sexo: 'macho',
    data_nascimento: '2025-06-01',
    data_entrada: '2025-06-01',
    lote_id: lote.body.id,
    mae_id: vaca.body.id,
  });
  assert.equal(bezerro.status, 201);
  assert.equal(bezerro.body.mae_id, vaca.body.id);

  const fichaVaca = await request('GET', `/api/animais/${vaca.body.id}`);
  assert.equal(fichaVaca.status, 200);
  assert.ok(fichaVaca.body.crias && fichaVaca.body.crias.length > 0);
  assert.equal(fichaVaca.body.crias[0].id_brinco, 'BEZERRO-01');

  const vinculo = await request('POST', `/api/animais/${vaca.body.id}/vincular-cria`, {
    cria_id: bezerro.body.id,
  });
  assert.equal(vinculo.status, 200);
});

test('Respostas 404 para entidades inexistentes', async () => {
  const animal = await request('GET', '/api/animais/99999');
  assert.equal(animal.status, 404);

  const lote = await request('GET', '/api/lotes/99999');
  assert.equal(lote.status, 404);
});

test('Respostas 400 para IDs inválidos', async () => {
  const animal = await request('GET', '/api/animais/abc');
  assert.equal(animal.status, 400);

  const lote = await request('GET', '/api/lotes/abc');
  assert.equal(lote.status, 400);
});

test('Respostas 409 para duplicidade de brinco', async () => {
  const lote = await request('POST', '/api/lotes', { nome: 'Lote Teste 7' });
  const payload = {
    id_brinco: 'BR-TEST-008',
    raca: 'Nelore',
    sexo: 'macho',
    data_nascimento: '2022-05-10',
    data_entrada: '2025-01-10',
    lote_id: lote.body.id,
  };

  const first = await request('POST', '/api/animais', payload);
  assert.equal(first.status, 201);

  const second = await request('POST', '/api/animais', payload);
  assert.equal(second.status, 409);
});

test('Endpoints de câmera/OCR/balança retornam 503 sem hardware', async () => {
  const res = await request('POST', '/api/pesagens/camera', {
    peso_kg: 450,
  });
  assert.equal(res.status, 503);
});

test('Classificação em casos normais e nas fronteiras de idade/peso', async () => {
  const { classificarAnimal } = require('../classificationService');

  // Fronteira: bezerro com 12 meses
  const bezerro = classificarAnimal({
    sexo: 'macho',
    idadeMeses: 12,
    condicaoReprodutiva: null,
    pesoArrobas: 5,
  });
  assert.ok(bezerro.categoria);

  // Fronteira: novilha com 24 meses
  const novilha = classificarAnimal({
    sexo: 'femea',
    idadeMeses: 24,
    condicaoReprodutiva: 'vazia',
    pesoArrobas: 10,
  });
  assert.ok(novilha.categoria);

  // Sem dados
  const semDados = classificarAnimal({
    sexo: 'macho',
    idadeMeses: null,
    condicaoReprodutiva: null,
    pesoArrobas: null,
  });
  assert.ok(semDados.categoria);
});

test('Limpeza do banco temporário', () => {
  const { db } = require('../../db/database');
  if (db && typeof db.close === 'function') {
    db.close();
  }
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    // Em Windows, o arquivo pode estar temporariamente bloqueado
    console.warn('Não foi possível remover diretório temporário:', e.message);
  }
});
