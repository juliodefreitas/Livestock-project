const { db } = require('./database');

const MIGRATIONS = [
  {
    id: 1,
    name: '001_initial_schema',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS lote (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL UNIQUE,
          descricao TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS animal (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_brinco TEXT NOT NULL UNIQUE,
          raca TEXT NOT NULL,
          sexo TEXT NOT NULL CHECK (sexo IN ('macho', 'femea')),
          data_nascimento TEXT,
          idade_estimada_meses INTEGER,
          condicao_reprodutiva TEXT CHECK (
            condicao_reprodutiva IS NULL OR condicao_reprodutiva IN (
              'inteiro', 'castrado', 'vazia', 'prenha', 'com_cria_ao_pe'
            )
          ),
          data_entrada TEXT NOT NULL,
          lote_id INTEGER NOT NULL REFERENCES lote(id) ON DELETE RESTRICT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS pesagem (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          animal_id INTEGER NOT NULL REFERENCES animal(id) ON DELETE CASCADE,
          peso_kg REAL NOT NULL CHECK (peso_kg > 0),
          data_pesagem TEXT NOT NULL DEFAULT (datetime('now')),
          origem TEXT DEFAULT 'balanca',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS cotacao_arroba (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          preco REAL NOT NULL CHECK (preco > 0),
          fonte TEXT NOT NULL DEFAULT 'manual',
          data_referencia TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_animal_lote ON animal(lote_id);
        CREATE INDEX IF NOT EXISTS idx_pesagem_animal ON pesagem(animal_id);
        CREATE INDEX IF NOT EXISTS idx_pesagem_data ON pesagem(data_pesagem);
      `);
    },
  },
];

function getAppliedMigrations() {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get();
  if (!row) return new Set();
  return new Set(db.prepare('SELECT name FROM migrations').all().map((r) => r.name));
}

function runMigrations() {
  const applied = getAppliedMigrations();

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;

    db.transaction(() => {
      migration.up();
      db.prepare('INSERT INTO migrations (id, name) VALUES (?, ?)').run(migration.id, migration.name);
    })();

    console.log(`Migration aplicada: ${migration.name}`);
  }
}

if (require.main === module) {
  runMigrations();
  console.log('Migrations concluídas.');
}

module.exports = { runMigrations };
