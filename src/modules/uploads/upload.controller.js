const UploadService = require('./upload.service');
const RagService    = require('./rag.service');

const UploadController = class {
  constructor(service, ragService) {
    this.service = service    || new UploadService();
    this.rag     = ragService || new RagService();
  }

  list = async (req, res, next) => {
    try {
      const { employee_id, page = 1, limit = 10, tags } = req.query;
      const tagFilter = tags
        ? String(tags).split(',').map(t => t.trim()).filter(Boolean)
        : [];
      const result = await this.service.listDocuments({
        employee_id: employee_id ? parseInt(employee_id, 10) : undefined,
        page:  parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100),
        tags:  tagFilter,
      });
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  };

  getById = async (req, res, next) => {
    try {
      const doc = await this.service.getDocument(parseInt(req.params.id, 10));
      if (doc.status === 'processing') {
        return res.status(404).json({
          success: false,
          message: 'Documento não encontrado ou ainda em processamento',
        });
      }
      res.json({ success: true, data: doc });
    } catch (err) { next(err); }
  };

  upload = async (req, res, next) => {
    try {
      const { employee_id, description, tags } = req.body;
      let tagList = [];
      if (Array.isArray(tags)) tagList = tags;
      else if (typeof tags === 'string') tagList = tags.split(',').map(t => t.trim()).filter(Boolean);

      const doc = await this.service.uploadDocument({
        file: req.file, employee_id, description, tags: tagList,
      });

      res.status(201).json({
        success: true,
        message: 'PDF enviado, analisado e classificado com sucesso',
        data: doc,
      });
    } catch (err) { next(err); }
  };

  /**
   * GET /api/uploads/:id/download
   *
   * Sends the PDF file with integrity headers so the client can verify
   * the download matches the hash recorded at upload time:
   *
   *   X-File-Hash:      sha256:<hex>
   *   X-File-Hash-Algo: SHA-256
   */
  download = async (req, res, next) => {
    try {
      const doc = await this.service.getDocument(parseInt(req.params.id, 10));

      if (doc.status !== 'ready') {
        return res.status(404).json({
          success: false,
          message: 'Documento não encontrado ou ainda em processamento',
        });
      }

      // Attach hash headers before streaming the file
      if (doc.sha256) {
        res.setHeader('X-File-Hash',      `sha256:${doc.sha256}`);
        res.setHeader('X-File-Hash-Algo', 'SHA-256');
      }

      res.download(this.service.getFilePath(doc.filename), doc.original_name);
    } catch (err) { next(err); }
  };

  /**
   * GET /api/uploads/:id/verify
   *
   * Re-hashes the file on disk and compares it to the stored SHA-256.
   * Useful for detecting accidental corruption or tampering.
   */
  verify = async (req, res, next) => {
    try {
      const result = await this.service.verifyIntegrity(parseInt(req.params.id, 10));

      res.status(result.ok ? 200 : 409).json({
        success: result.ok,
        data: {
          integrity: result.ok ? 'ok' : 'mismatch',
          stored_hash: result.stored,
          actual_hash: result.actual,
          message: result.ok
            ? 'Arquivo íntegro — hash confere com o registrado no upload'
            : 'ATENÇÃO: hash não confere — o arquivo pode ter sido corrompido ou alterado',
        },
      });
    } catch (err) { next(err); }
  };

  remove = async (req, res, next) => {
    try {
      await this.service.deleteDocument(parseInt(req.params.id, 10));
      res.json({ success: true, message: 'Documento removido com sucesso' });
    } catch (err) { next(err); }
  };

  listTags = async (req, res, next) => {
    try {
      const tags = await this.service.getAllTags();
      res.json({ success: true, data: tags });
    } catch (err) { next(err); }
  };

  search = async (req, res, next) => {
    try {
      const { document_id, query, top_k = 5 } = req.body;

      if (!document_id || !query) {
        return res.status(400).json({
          success: false,
          message: 'Os campos document_id e query são obrigatórios',
        });
      }

      const doc = await this.service.getDocument(parseInt(document_id, 10));
      if (doc.status !== 'ready') {
        return res.status(422).json({
          success: false,
          message: 'Documento ainda não foi processado',
        });
      }

      const chunks = await this.rag.searchChunks(
        parseInt(document_id, 10),
        String(query),
        Math.min(parseInt(top_k, 10), 20)
      );

      res.json({
        success: true,
        data: chunks.map(c => ({
          chunk_index: c.chunk_index,
          content:     c.content,
          score:       parseFloat(c.score.toFixed(4)),
        })),
      });
    } catch (err) { next(err); }
  };
};

module.exports = UploadController;
