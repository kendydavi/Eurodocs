const { Router } = require('express');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const UploadController = require('./upload.controller');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/pdfs';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename:    (_, file, cb) => {
    const unique = `doc_${Date.now()}_${Math.round(Math.random() * 1e5)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    file.mimetype === 'application/pdf'
      ? cb(null, true)
      : cb(new Error('Apenas arquivos PDF são permitidos')),
});

const router = Router();
const ctrl   = new UploadController();

/**
 * @swagger
 * tags:
 *   name: Documentos PDF
 *   description: Upload e gerenciamento de documentos PDF com hash de integridade, classificação automática via LLM e RAG
 */

/**
 * @swagger
 * /api/uploads/tags:
 *   get:
 *     summary: Listar todas as tags disponíveis
 *     tags: [Documentos PDF]
 *     responses:
 *       200:
 *         description: Lista de tags únicas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items: { type: string }
 *                   example: ["contrato", "rh", "financeiro"]
 */
router.get('/tags', ctrl.listTags);

/**
 * @swagger
 * /api/uploads/search:
 *   post:
 *     summary: Busca semântica dentro de um documento indexado
 *     tags: [Documentos PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [document_id, query]
 *             properties:
 *               document_id: { type: integer, example: 1 }
 *               query: { type: string, example: "data de admissão do funcionário" }
 *               top_k: { type: integer, default: 5 }
 *     responses:
 *       200:
 *         description: Trechos mais relevantes encontrados no documento
 *       422:
 *         description: Documento ainda não processado
 */
router.post('/search', ctrl.search);

/**
 * @swagger
 * /api/uploads:
 *   get:
 *     summary: Listar documentos enviados
 *     description: Retorna apenas documentos com status 'ready' (análise LLM concluída).
 *     tags: [Documentos PDF]
 *     parameters:
 *       - in: query
 *         name: employee_id
 *         schema: { type: integer }
 *       - in: query
 *         name: tags
 *         schema: { type: string }
 *         description: "Tags separadas por virgula (ex: contrato,rh)"
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Lista paginada de documentos prontos
 */
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);

/**
 * @swagger
 * /api/uploads/{id}/download:
 *   get:
 *     summary: Baixar arquivo PDF
 *     description: |
 *       Retorna o arquivo PDF com os seguintes headers de integridade:
 *       - `X-File-Hash: sha256:<hex>` — hash SHA-256 gravado no momento do upload
 *       - `X-File-Hash-Algo: SHA-256`
 *
 *       O cliente pode usar esses headers para verificar se o arquivo recebido
 *       corresponde exatamente ao arquivo enviado originalmente.
 *     tags: [Documentos PDF]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Arquivo PDF com headers de integridade
 *         headers:
 *           X-File-Hash:
 *             description: Hash SHA-256 do arquivo no formato "sha256:<hex>"
 *             schema: { type: string, example: "sha256:e3b0c44298fc1c149afb..." }
 *           X-File-Hash-Algo:
 *             description: Algoritmo utilizado
 *             schema: { type: string, example: "SHA-256" }
 *       404:
 *         description: Documento não encontrado ou ainda em processamento
 */
router.get('/:id/download', ctrl.download);

/**
 * @swagger
 * /api/uploads/{id}/verify:
 *   get:
 *     summary: Verificar integridade do arquivo
 *     description: |
 *       Re-calcula o hash SHA-256 do arquivo em disco e compara com o hash
 *       registrado no momento do upload. Útil para detectar corrupção acidental
 *       ou alteração indevida do arquivo.
 *     tags: [Documentos PDF]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Arquivo íntegro — hashes conferem
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     integrity: { type: string, example: "ok" }
 *                     stored_hash: { type: string }
 *                     actual_hash: { type: string }
 *                     message: { type: string }
 *       409:
 *         description: Hash não confere — arquivo possivelmente corrompido ou alterado
 *       422:
 *         description: Documento ainda não está pronto
 *       404:
 *         description: Arquivo físico não encontrado no servidor
 */
router.get('/:id/verify', ctrl.verify);

/**
 * @swagger
 * /api/uploads:
 *   post:
 *     summary: Enviar e classificar documento PDF
 *     description: |
 *       Pipeline síncrono em 5 etapas:
 *       1. Validação do arquivo (mimetype, tamanho)
 *       2. Cálculo do hash SHA-256 do arquivo para garantia de integridade
 *       3. Indexação RAG (extração de texto → chunks → embeddings via Ollama)
 *       4. Classificação automática via LLM (geração de tags)
 *       5. Persistência do hash, tags e liberação do documento (status='ready')
 *
 *       O documento só fica disponível para listagem e download **após** as tags serem definidas.
 *       O hash SHA-256 é retornado na resposta e acompanha todos os downloads via header `X-File-Hash`.
 *     tags: [Documentos PDF]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               employee_id: { type: integer }
 *               description: { type: string }
 *               tags:
 *                 type: string
 *                 description: "Tags manuais separadas por vírgula — mescladas com as geradas pela LLM"
 *     responses:
 *       201:
 *         description: PDF enviado, indexado e classificado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     original_name: { type: string }
 *                     sha256: { type: string, description: "Hash SHA-256 do arquivo" }
 *                     tags:
 *                       type: array
 *                       items: { type: string }
 *                     status: { type: string, enum: [ready] }
 *       422:
 *         description: Falha no pipeline de análise
 */
router.post('/', upload.single('file'), ctrl.upload);

router.delete('/:id', ctrl.remove);

module.exports = router;
