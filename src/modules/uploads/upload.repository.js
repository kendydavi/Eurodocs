const { getDatabase } = require('../../config/database');

class UploadRepository {
  constructor(db) {
    this.db = db || getDatabase();
  }

  findAll({ employee_id, tags, page = 1, limit = 10 } = {}) {
    const offset = (page - 1) * limit;

    const conditions = ["d.status = 'ready'"];
    const params     = [];

    if (employee_id) { conditions.push('d.employee_id = ?'); params.push(employee_id); }

    if (tags && tags.length) {
      tags.forEach(t => {
        conditions.push(`EXISTS (
          SELECT 1 FROM pdf_tags pt WHERE pt.document_id = d.id AND pt.tag = ?
        )`);
        params.push(t);
      });
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const total = this.db.prepare(`
      SELECT COUNT(*) as count FROM pdf_documents d ${where}
    `).get(...params).count;

    const rows = this.db.prepare(`
      SELECT d.*, e.name as employee_name
      FROM pdf_documents d
      LEFT JOIN employees e ON d.employee_id = e.id
      ${where}
      ORDER BY d.uploaded_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return {
      data:  rows.map(r => this._withTags(r)),
      total, page, limit,
      pages: Math.ceil(total / limit),
    };
  }

  findById(id) {
    const row = this.db.prepare(`
      SELECT d.*, e.name as employee_name
      FROM pdf_documents d
      LEFT JOIN employees e ON d.employee_id = e.id
      WHERE d.id = ?
    `).get(id);
    return row ? this._withTags(row) : null;
  }

  create({ employee_id, filename, original_name, mimetype, size, sha256, description, tags = [], status = 'processing' }) {
    const result = this.db.prepare(`
      INSERT INTO pdf_documents (employee_id, filename, original_name, mimetype, size, sha256, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(employee_id || null, filename, original_name, mimetype, size, sha256, description || null, status);

    const id = result.lastInsertRowid;
    if (tags.length) this._saveTags(id, tags);
    return this.findById(id);
  }

  updateTagsAndStatus(id, tags, status = 'ready') {
    this._saveTags(id, tags);
    this.db.prepare(
      'UPDATE pdf_documents SET status = ? WHERE id = ?'
    ).run(status, id);
  }

  delete(id) {
    return this.db.prepare('DELETE FROM pdf_documents WHERE id = ?').run(id).changes > 0;
  }

  allTags() {
    return this.db.prepare(
      'SELECT DISTINCT tag FROM pdf_tags ORDER BY tag ASC'
    ).all().map(r => r.tag);
  }

  _saveTags(documentId, tags) {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO pdf_tags (document_id, tag) VALUES (?, ?)'
    );
    const normalized = [...new Set(
      tags.map(t => t.trim().toLowerCase()).filter(Boolean)
    )];
    normalized.forEach(tag => stmt.run(documentId, tag));
  }

  _tagsOf(documentId) {
    return this.db.prepare(
      'SELECT tag FROM pdf_tags WHERE document_id = ? ORDER BY tag ASC'
    ).all(documentId).map(r => r.tag);
  }

  _withTags(row) {
    return { ...row, tags: this._tagsOf(row.id) };
  }
}

module.exports = UploadRepository;
