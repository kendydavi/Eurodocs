const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const UploadRepository = require('./upload.repository');
const RagService       = require('./rag.service');

const getUploadDir    = () => process.env.UPLOAD_DIR || './uploads/pdfs';
const getMaxSizeBytes = () => (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024;

const AVAILABLE_TAGS = [
  'contrato', 'rh', 'financeiro', 'juridico',
  'folha-de-pagamento', 'rescisao', 'beneficios', 'treinamento',
  'advertencia', 'ferias', 'admissao', 'demissao',
];


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

    const filePath = path.join(getUploadDir(), path.basename(file.path));
    const sha256   = await hashFile(filePath);

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
      await this.rag.indexDocument(doc.id, filePath);

      const labelResult = await this.rag.autoLabel(doc.id, AVAILABLE_TAGS);

      const mergedTags = [...new Set([...labelResult.tags, ...manualTags])];

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
