const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const UploadRepository = require('./upload.repository');
const RagService       = require('./rag.service');

const getUploadDir    = () => process.env.UPLOAD_DIR || './uploads/pdfs';
const getMaxSizeBytes = () => (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024;

// Suggested labels passed to the LLM as hints.
const AVAILABLE_TAGS = [
  'contrato', 'rh', 'financeiro', 'juridico',
  'folha-de-pagamento', 'rescisao', 'beneficios', 'treinamento',
  'advertencia', 'ferias', 'admissao', 'demissao',
];

/**
 * Compute a SHA-256 hex digest from a file on disk.
 * Uses streaming so large files don't load entirely into memory.
 */
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end',  ()    => resolve(hash.digest('hex')));
    stream.on('error', err  => reject(err));
  });
}

class UploadService {
  constructor(repository, ragService) {
    this.repo = repository || new UploadRepository();
    this.rag  = ragService  || new RagService();
  }

  async listDocuments(filters) {
    return this.repo.findAll(filters);
  }

  async getDocument(id) {
    const doc = this.repo.findById(id);
    if (!doc) throw Object.assign(new Error('Documento não encontrado'), { status: 404 });
    return doc;
  }

  /**
   * Upload pipeline (fully synchronous before the document becomes available):
   *  1. Validate file (mimetype, size)
   *  2. Compute SHA-256 hash of the file bytes
   *  3. Persist metadata with hash (status: 'processing')
   *  4. Index document chunks via RAG (extract → chunk → embed)
   *  5. Auto-label via LLM → persist tags
   *  6. Mark document as 'ready' — only now it appears in listings / can be downloaded
   *
   * If any step after (3) fails the file is removed and the DB record is deleted.
   */
  async uploadDocument({ file, employee_id, description, tags = [] }) {
    if (!file) throw Object.assign(new Error('Nenhum arquivo enviado'), { status: 400 });

    if (file.mimetype !== 'application/pdf') {
      this._cleanFile(file.path);
      throw Object.assign(new Error('Apenas arquivos PDF são permitidos'), { status: 400 });
    }

    if (file.size > getMaxSizeBytes()) {
      this._cleanFile(file.path);
      throw Object.assign(new Error(`Arquivo excede ${getMaxSizeBytes() / 1024 / 1024}MB`), { status: 400 });
    }

    const manualTags = Array.isArray(tags)
      ? tags
      : String(tags).split(',').map(t => t.trim()).filter(Boolean);

    // ── Step 1: Compute SHA-256 hash of the uploaded file ───────────────────
    const filePath = path.join(getUploadDir(), path.basename(file.path));
    const sha256   = await hashFile(filePath);

    // ── Step 2: Persist metadata (with hash) and status='processing' ────────
    const doc = await this.repo.create({
      employee_id:   employee_id ? parseInt(employee_id, 10) : null,
      filename:      path.basename(file.path),
      original_name: file.originalname,
      mimetype:      file.mimetype,
      size:          file.size,
      sha256,
      description:   description || null,
      tags:          [],
      status:        'processing',
    });

    try {
      // ── Step 3: RAG indexing ───────────────────────────────────────────────
      await this.rag.indexDocument(doc.id, filePath);

      // ── Step 4: LLM auto-labeling ──────────────────────────────────────────
      const labelResult = await this.rag.autoLabel(doc.id, AVAILABLE_TAGS);

      const mergedTags = [...new Set([...labelResult.tags, ...manualTags])];

      // ── Step 5: Persist tags and mark document as 'ready' ──────────────────
      await this.repo.updateTagsAndStatus(doc.id, mergedTags, 'ready');

      return this.repo.findById(doc.id);

    } catch (err) {
      console.error(`[Upload] Falha no pipeline do documento ${doc.id}:`, err.message);
      await this.repo.delete(doc.id);
      this._cleanFile(filePath);
      throw Object.assign(
        new Error(`Falha ao processar documento: ${err.message}`),
        { status: 422 }
      );
    }
  }

  /**
   * Verify that the file on disk still matches its recorded SHA-256 hash.
   * Returns { ok: true } or { ok: false, stored, actual }.
   */
  async verifyIntegrity(id) {
    const doc = await this.getDocument(id);
    if (doc.status !== 'ready') {
      throw Object.assign(new Error('Documento ainda não está pronto'), { status: 422 });
    }
    const filePath = this.getFilePath(doc.filename);
    if (!fs.existsSync(filePath)) {
      throw Object.assign(new Error('Arquivo físico não encontrado no servidor'), { status: 404 });
    }
    const actual = await hashFile(filePath);
    return {
      ok:     actual === doc.sha256,
      stored: doc.sha256,
      actual,
    };
  }

  async deleteDocument(id) {
    const doc = await this.getDocument(id);
    this._cleanFile(path.join(getUploadDir(), doc.filename));
    return this.repo.delete(id);
  }

  async getAllTags() {
    return this.repo.allTags();
  }

  getFilePath(filename) {
    return path.join(getUploadDir(), filename);
  }

  _cleanFile(filePath) {
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
  }
}

module.exports = UploadService;
