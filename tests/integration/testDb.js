const Database = require('better-sqlite3');

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      cpf TEXT NOT NULL UNIQUE, department TEXT NOT NULL,
      role TEXT NOT NULL, salary REAL NOT NULL,
      hire_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS pdf_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER, filename TEXT NOT NULL,
      original_name TEXT NOT NULL, mimetype TEXT NOT NULL,
      size INTEGER NOT NULL, description TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS pdf_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES pdf_documents(id) ON DELETE CASCADE,
      UNIQUE(document_id, tag)
    );
    CREATE INDEX IF NOT EXISTS idx_pdf_tags_tag ON pdf_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_pdf_tags_doc ON pdf_tags(document_id);
  `);
  return db;
}

module.exports = { createTestDb };
