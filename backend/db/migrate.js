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
  {
    id: 2,
    name: '002_fazendas_e_sessoes',
    up: () => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS fazenda (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cnpj TEXT NOT NULL UNIQUE,
          nome TEXT NOT NULL,
          senha_hash TEXT NOT NULL,
          ativo INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sessao_fazenda (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fazenda_id INTEGER NOT NULL REFERENCES fazenda(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        ALTER TABLE lote ADD COLUMN fazenda_id INTEGER REFERENCES fazenda(id);
        ALTER TABLE cotacao_arroba ADD COLUMN fazenda_id INTEGER REFERENCES fazenda(id);
        CREATE INDEX IF NOT EXISTS idx_lote_fazenda ON lote(fazenda_id);
        CREATE INDEX IF NOT EXISTS idx_cotacao_fazenda ON cotacao_arroba(fazenda_id);
        CREATE INDEX IF NOT EXISTS idx_sessao_token ON sessao_fazenda(token_hash);
      `);
    },
  },
  {
    id: 3,
    name: '003_cria_ao_pe_e_cotacoes_categoria',
    up: () => {
      db.exec(`
        ALTER TABLE animal ADD COLUMN mae_id INTEGER REFERENCES animal(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_animal_mae ON animal(mae_id);

        CREATE TABLE IF NOT EXISTS cotacao_categoria (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          categoria TEXT NOT NULL,
          preco REAL NOT NULL CHECK (preco > 0),
          fonte TEXT NOT NULL DEFAULT 'manual',
          data_referencia TEXT NOT NULL,
          fazenda_id INTEGER REFERENCES fazenda(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_cotacao_cat_fazenda ON cotacao_categoria(fazenda_id, categoria);
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
