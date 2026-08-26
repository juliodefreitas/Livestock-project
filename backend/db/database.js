const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, 'pecuaria.db');

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
const configuredBusyTimeout = Number(process.env.SQLITE_BUSY_TIMEOUT_MS);
const busyTimeoutMs = Number.isFinite(configuredBusyTimeout) && configuredBusyTimeout > 0
  ? configuredBusyTimeout
  : 15000;

if (process.env.NODE_ENV !== 'test') {
  db.exec('PRAGMA journal_mode = WAL;');
}
db.exec('PRAGMA foreign_keys = ON;');
db.exec(`PRAGMA busy_timeout = ${Math.floor(busyTimeoutMs)};`);

if (typeof db.transaction !== 'function') {
  db.transaction = (fn) => {
    return (...args) => {
      db.exec('BEGIN');
      try {
        const result = fn(...args);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    };
  };
}

module.exports = { db, DB_PATH };
