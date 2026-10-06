const bcrypt = require('bcryptjs');
const { db } = require('./database');
const { runMigrations } = require('./migrate');

const DEMO_FAZENDA = {
  cnpj: '12345678000190',
  nome: 'Fazenda Modelo Pecuária Smart',
  senha: 'senha-segura-123',
};

function seed() {
  runMigrations();

  // 1. Garantir que a Fazenda Demo exista
  let fazenda = db.prepare('SELECT * FROM fazenda WHERE cnpj = ?').get(DEMO_FAZENDA.cnpj);
  if (!fazenda) {
    const senhaHash = bcrypt.hashSync(DEMO_FAZENDA.senha, 10);
    const res = db.prepare(
      'INSERT INTO fazenda (cnpj, nome, senha_hash) VALUES (?, ?, ?)'
    ).run(DEMO_FAZENDA.cnpj, DEMO_FAZENDA.nome, senhaHash);
    fazenda = db.prepare('SELECT * FROM fazenda WHERE id = ?').get(res.lastInsertRowid);
    console.log(`Fazenda Demo criada: CNPJ ${DEMO_FAZENDA.cnpj} (Senha: ${DEMO_FAZENDA.senha})`);
  }

  const existing = db.prepare('SELECT COUNT(*) AS c FROM lote WHERE fazenda_id = ?').get(fazenda.id);
  if (existing.c > 0) {
    console.log('Banco já possui dados para a fazenda demo. Seed concluído.');
    return;
  }

  const insertLote = db.prepare('INSERT INTO lote (nome, descricao, fazenda_id) VALUES (?, ?, ?)');
  const loteA = insertLote.run('Lote Confinamento A', 'Bovinos de corte — confinamento fase terminação', fazenda.id);
  const loteB = insertLote.run('Lote Confinamento B', 'Novilhas em recria e matrizes', fazenda.id);

  db.prepare('INSERT INTO cotacao_arroba (preco, fonte, data_referencia, fazenda_id) VALUES (?, ?, ?, ?)').run(
    315.5,
    'CEPEA/Esalq - Indicador Boi Gordo',
    new Date().toISOString().split('T')[0],
    fazenda.id
  );

  const cotacoesCategoria = [
    ['Boi gordo', 315.5],
    ['Vaca gorda', 290.0],
    ['Novilha', 295.0],
    ['Novilho', 310.0],
    ['Bezerro', 2450.0],
    ['Bezerra', 2150.0],
    ['Garrote', 305.0],
    ['Touro', 270.0],
  ];

  const insertCotacaoCat = db.prepare(
    'INSERT INTO cotacao_categoria (categoria, preco, fonte, data_referencia, fazenda_id) VALUES (?, ?, ?, ?, ?)'
  );
  for (const [cat, preco] of cotacoesCategoria) {
    insertCotacaoCat.run(cat, preco, 'CEPEA/Esalq Médias', new Date().toISOString().split('T')[0], fazenda.id);
  }

  const insertAnimal = db.prepare(`
    INSERT INTO animal (id_brinco, raca, sexo, data_nascimento, condicao_reprodutiva, data_entrada, lote_id, mae_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Cadastrar matrizes e machos primeiro
  const a1 = insertAnimal.run('BR-001', 'Nelore', 'macho', '2023-06-15', 'castrado', '2025-01-10', loteA.lastInsertRowid, null);
  const a2 = insertAnimal.run('BR-002', 'Angus x Nelore', 'macho', '2022-03-20', 'inteiro', '2025-01-10', loteA.lastInsertRowid, null);
  const a3 = insertAnimal.run('BR-003', 'Nelore', 'macho', '2024-08-01', 'inteiro', '2025-02-01', loteA.lastInsertRowid, null);
  const a4 = insertAnimal.run('BR-004', 'Angus', 'femea', '2023-11-10', 'vazia', '2025-01-15', loteB.lastInsertRowid, null);
  const a5 = insertAnimal.run('BR-005', 'Nelore', 'femea', '2022-07-05', 'com_cria_ao_pe', '2025-01-15', loteB.lastInsertRowid, null);
  const a6 = insertAnimal.run('BR-006', 'Brahman', 'macho', '2021-01-12', 'castrado', '2024-12-01', loteA.lastInsertRowid, null);

  // Bezerro vinculado à matriz BR-005
  const a7 = insertAnimal.run('BR-007', 'Nelore', 'macho', '2025-10-12', 'inteiro', '2025-10-12', loteB.lastInsertRowid, a5.lastInsertRowid);

  const animalIds = [a1.lastInsertRowid, a2.lastInsertRowid, a3.lastInsertRowid, a4.lastInsertRowid, a5.lastInsertRowid, a6.lastInsertRowid, a7.lastInsertRowid];

  const insertPesagem = db.prepare(
    'INSERT INTO pesagem (animal_id, peso_kg, data_pesagem) VALUES (?, ?, ?)'
  );

  const pesagens = [
    [animalIds[0], 420, '2025-06-01'],
    [animalIds[0], 465, '2025-09-01'],
    [animalIds[0], 510, '2026-01-15'],
    [animalIds[1], 380, '2025-06-01'],
    [animalIds[1], 430, '2025-09-01'],
    [animalIds[1], 480, '2026-01-15'],
    [animalIds[2], 180, '2025-09-01'],
    [animalIds[2], 220, '2026-01-15'],
    [animalIds[3], 310, '2025-07-01'],
    [animalIds[3], 340, '2026-01-15'],
    [animalIds[4], 450, '2025-07-01'],
    [animalIds[4], 470, '2026-01-15'],
    [animalIds[5], 520, '2025-06-01'],
    [animalIds[5], 545, '2026-01-15'],
    [animalIds[6], 45, '2025-10-15'],
    [animalIds[6], 95, '2026-01-15'],
  ];

  for (const p of pesagens) {
    insertPesagem.run(...p);
  }

  console.log('Seed concluído: Fazenda Demo, 2 lotes, 7 animais com cria vinculada, pesagens e cotações por categoria.');
}

if (require.main === module) {
  runMigrations();
  seed();
}

module.exports = { seed, DEMO_FAZENDA };
