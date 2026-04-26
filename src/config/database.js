const Database = require('better-sqlite3');
const path = require('path');

let db;

function getDatabase(dbPath) {
  const resolvedPath = dbPath || process.env.DB_PATH || './database.sqlite';
  if (!db || db.name !== path.resolve(resolvedPath)) {
    db = new Database(path.resolve(resolvedPath));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      cpf         TEXT    NOT NULL UNIQUE,
      department  TEXT    NOT NULL,
      role        TEXT    NOT NULL,
      salary      REAL    NOT NULL,
      hire_date   TEXT    NOT NULL,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pdf_documents (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id   INTEGER,
      filename      TEXT    NOT NULL,
      original_name TEXT    NOT NULL,
      mimetype      TEXT    NOT NULL,
      size          INTEGER NOT NULL,
      sha256        TEXT,
      description   TEXT,
      status        TEXT    NOT NULL DEFAULT 'ready',
      uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS pdf_tags (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      tag         TEXT    NOT NULL,
      FOREIGN KEY (document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE,
      UNIQUE(document_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_pdf_tags_tag ON pdf_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_pdf_tags_doc ON pdf_tags(document_id);

    CREATE TABLE IF NOT EXISTS document_chunks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      content     TEXT    NOT NULL,
      embedding   TEXT    NOT NULL,
      FOREIGN KEY (document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON document_chunks(document_id);
  `);

  // Safe incremental migrations for pre-existing databases
  const alterColumns = [
    `ALTER TABLE pdf_documents ADD COLUMN status TEXT NOT NULL DEFAULT 'ready'`,
    `ALTER TABLE pdf_documents ADD COLUMN sha256 TEXT`,
  ];
  for (const stmt of alterColumns) {
    try { database.exec(stmt); } catch (_) { /* column already exists */ }
  }
}

function closeDatabase() {
  if (db) { db.close(); db = null; }
}

module.exports = { getDatabase, closeDatabase };
