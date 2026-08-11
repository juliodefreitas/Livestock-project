const { db } = require('./database');
const { runMigrations } = require('./migrate');

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM lote').get();
  if (existing.c > 0) {
    console.log('Banco já possui dados. Seed ignorado.');
    return;
  }

  const insertLote = db.prepare('INSERT INTO lote (nome, descricao) VALUES (?, ?)');
  const loteA = insertLote.run('Lote Confinamento A', 'Bovinos de corte — confinamento fase terminacao');
  const loteB = insertLote.run('Lote Confinamento B', 'Novilhas em recria');

  db.prepare('INSERT INTO cotacao_arroba (preco, fonte, data_referencia) VALUES (?, ?, ?)').run(
    285.5,
    'manual',
    new Date().toISOString().split('T')[0]
  );

  const insertAnimal = db.prepare(`
    INSERT INTO animal (id_brinco, raca, sexo, data_nascimento, condicao_reprodutiva, data_entrada, lote_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const animais = [
    ['BR-001', 'Nelore', 'macho', '2023-06-15', 'castrado', '2025-01-10', loteA.lastInsertRowid],
    ['BR-002', 'Angus x Nelore', 'macho', '2022-03-20', 'inteiro', '2025-01-10', loteA.lastInsertRowid],
    ['BR-003', 'Nelore', 'macho', '2024-08-01', 'inteiro', '2025-02-01', loteA.lastInsertRowid],
    ['BR-004', 'Angus', 'femea', '2023-11-10', 'vazia', '2025-01-15', loteB.lastInsertRowid],
    ['BR-005', 'Nelore', 'femea', '2022-07-05', 'prenha', '2025-01-15', loteB.lastInsertRowid],
    ['BR-006', 'Brahman', 'macho', '2021-01-12', 'castrado', '2024-12-01', loteA.lastInsertRowid],
  ];

  const animalIds = [];
  for (const a of animais) {
    const r = insertAnimal.run(...a);
    animalIds.push(r.lastInsertRowid);
  }

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
  ];

  for (const p of pesagens) {
    insertPesagem.run(...p);
  }

  console.log('Seed concluído: 2 lotes, 6 animais, 14 pesagens, cotação R$ 285,50/@');
}

if (require.main === module) {
  runMigrations();
  seed();
}

module.exports = { seed };
