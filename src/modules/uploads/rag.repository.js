const { getDatabase } = require('../../config/database');

class RagRepository {
  constructor(db) {
    this.db = db || getDatabase();
  }

  /**
   * Persist an array of { content, embedding } rows for a document.
   * Runs inside a single transaction for performance.
   */
  saveChunks(documentId, chunks) {
    const stmt = this.db.prepare(`
      INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
      VALUES (?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((rows) => {
      rows.forEach((chunk, i) =>
        stmt.run(documentId, i, chunk.content, JSON.stringify(chunk.embedding))
      );
    });
    insertMany(chunks);
  }

  /**
   * Retrieve all chunks for a document, with embeddings parsed back to float[].
   */
  getAllChunks(documentId) {
    return this.db.prepare(`
      SELECT id, chunk_index, content, embedding
      FROM document_chunks
      WHERE document_id = ?
      ORDER BY chunk_index ASC
    `).all(documentId).map(r => ({
      ...r,
      embedding: JSON.parse(r.embedding),
    }));
  }

  /**
   * Remove all chunks for a document (used before re-indexing).
   */
  deleteByDocument(documentId) {
    this.db.prepare(
      'DELETE FROM document_chunks WHERE document_id = ?'
    ).run(documentId);
  }

  /**
   * Check whether a document has already been indexed.
   */
  isIndexed(documentId) {
    const row = this.db.prepare(
      'SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ?'
    ).get(documentId);
    return row.count > 0;
  }
}

module.exports = RagRepository;
