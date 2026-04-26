const request = require('supertest');
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { createTestDb } = require('./testDb');

const UploadRepository = require('../../src/modules/uploads/upload.repository');
const UploadService    = require('../../src/modules/uploads/upload.service');
const UploadController = require('../../src/modules/uploads/upload.controller');
const { errorHandler } = require('../../src/middleware/errorHandler');

const TEST_UPLOAD_DIR = path.join(os.tmpdir(), `test_uploads_${process.pid}_${Date.now()}`);

function buildApp(db) {
  process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;
  fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, TEST_UPLOAD_DIR),
    filename:    (_, file, cb) =>
      cb(null, `test_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
  });
  const upload = multer({ storage });

  const repo = new UploadRepository(db);
  const svc  = new UploadService(repo);
  const ctrl = new UploadController(svc);

  const { Router } = require('express');
  const router = Router();
  router.get('/tags',           ctrl.listTags);
  router.get('/',               ctrl.list);
  router.get('/:id',            ctrl.getById);
  router.get('/:id/download',   ctrl.download);
  router.post('/', upload.single('file'), ctrl.upload);
  router.delete('/:id',         ctrl.remove);

  const app = express();
  app.use(express.json());
  app.use('/api/uploads', router);
  app.use(errorHandler);
  return app;
}

function createTempPdf(name = 'test.pdf') {
  const p = path.join(os.tmpdir(), `${Date.now()}_${name}`);
  fs.writeFileSync(p, Buffer.from('%PDF-1.4\n1 0 obj<</Type /Catalog>>endobj\n%%EOF'));
  return p;
}

function seedEmployee(db) {
  return db.prepare(`
    INSERT INTO employees (name, email, cpf, department, role, salary, hire_date)
    VALUES ('Teste', 'teste@email.com', '000.000.000-00', 'TI', 'Dev', 5000, '2023-01-01')
  `).run().lastInsertRowid;
}

describe('Upload Routes — Integration', () => {
  let app, db;

  beforeEach(() => { db = createTestDb(); app = buildApp(db); });
  afterEach(() => {
    db.close();
    try { fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true }); } catch (_) {}
  });

  // ── POST /api/uploads ──────────────────────────────────────────────────
  describe('POST /api/uploads', () => {
    it('201 — upload de PDF feito com sucesso', async () => {
      const p = createTempPdf('up1.pdf');
      const res = await request(app).post('/api/uploads').attach('file', p);
      expect(res.status).toBe(201);
      expect(res.body.data.mimetype).toBe('application/pdf');
      expect(res.body.data.tags).toEqual([]);
      fs.unlinkSync(p);
    });

    it('201 — armazena tags no upload', async () => {
      const p = createTempPdf('up2.pdf');
      const res = await request(app)
        .post('/api/uploads')
        .attach('file', p)
        .field('tags', 'contrato,rh');
      expect(res.status).toBe(201);
      expect(res.body.data.tags).toEqual(expect.arrayContaining(['contrato', 'rh']));
      fs.unlinkSync(p);
    });

    it('201 — associa PDF com funcionário', async () => {
      const empId = seedEmployee(db);
      const p = createTempPdf('up3.pdf');
      const res = await request(app)
        .post('/api/uploads')
        .attach('file', p)
        .field('employee_id', String(empId));
      expect(res.status).toBe(201);
      expect(res.body.data.employee_id).toBe(empId);
      fs.unlinkSync(p);
    });

    it('400 — PDF sem ser eviado', async () => {
      const res = await request(app).post('/api/uploads').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/uploads/tags ──────────────────────────────────────────────
  describe('GET /api/uploads/tags', () => {
    it('200 — retorna array nulo', async () => {
      const res = await request(app).get('/api/uploads/tags');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('200 — tags após o upload', async () => {
      const p = createTempPdf('tag_test.pdf');
      await request(app).post('/api/uploads').attach('file', p).field('tags', 'rh,juridico');
      fs.unlinkSync(p);

      const res = await request(app).get('/api/uploads/tags');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(expect.arrayContaining(['juridico', 'rh']));
    });
  });

  // ── GET /api/uploads — tag filter ─────────────────────────────────────
  describe('GET /api/uploads (tag filter)', () => {
    beforeEach(async () => {
      const p1 = createTempPdf('a.pdf');
      const p2 = createTempPdf('b.pdf');
      await request(app).post('/api/uploads').attach('file', p1).field('tags', 'contrato,rh');
      await request(app).post('/api/uploads').attach('file', p2).field('tags', 'financeiro');
      fs.unlinkSync(p1); fs.unlinkSync(p2);
    });

    it('retorna todos os docs que estáo sem tag', async () => {
      const res = await request(app).get('/api/uploads');
      expect(res.body.total).toBe(2);
    });

    it('filtra por uma tag', async () => {
      const res = await request(app).get('/api/uploads?tags=rh');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].tags).toContain('rh');
    });

    it('filtra por várias tags', async () => {
      const res = await request(app).get('/api/uploads?tags=contrato,rh');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('retorna vazio ao não ter match', async () => {
      const res = await request(app).get('/api/uploads?tags=inexistente');
      expect(res.body.data.length).toBe(0);
    });
  });

  // ── GET /api/uploads/:id ───────────────────────────────────────────────
  describe('GET /api/uploads/:id', () => {
    it('200 — retorna metadata do documento com tags', async () => {
      const p = createTempPdf('meta.pdf');
      const created = await request(app)
        .post('/api/uploads').attach('file', p).field('tags', 'teste');
      fs.unlinkSync(p);
      const res = await request(app).get(`/api/uploads/${created.body.data.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.tags).toContain('teste');
    });

    it('404 —erro por id desconhecido', async () => {
      expect((await request(app).get('/api/uploads/9999')).status).toBe(404);
    });
  });

  // ── GET /api/uploads/:id/download ─────────────────────────────────────
  describe('GET /api/uploads/:id/download', () => {
    it('200 — streams arquivo PDF', async () => {
      const p = createTempPdf('dl.pdf');
      const created = await request(app).post('/api/uploads').attach('file', p);
      fs.unlinkSync(p);
      const res = await request(app).get(`/api/uploads/${created.body.data.id}/download`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBeDefined();
    });

    it('404 — id desconhecido', async () => {
      expect((await request(app).get('/api/uploads/9999/download')).status).toBe(404);
    });
  });

  // ── DELETE /api/uploads/:id ────────────────────────────────────────────
  describe('DELETE /api/uploads/:id', () => {
    it('200 — deleta documento e notifica sucesso', async () => {
      const p = createTempPdf('del.pdf');
      const created = await request(app).post('/api/uploads').attach('file', p);
      fs.unlinkSync(p);
      const id  = created.body.data.id;
      const res = await request(app).delete(`/api/uploads/${id}`);
      expect(res.status).toBe(200);
      expect((await request(app).get(`/api/uploads/${id}`)).status).toBe(404);
    });

    it('404 — id desconhecido', async () => {
      expect((await request(app).delete('/api/uploads/9999')).status).toBe(404);
    });
  });
});
