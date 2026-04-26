const request = require('supertest');
const express = require('express');
const { createTestDb } = require('./testDb');

const EmployeeRepository = require('../../src/modules/employees/employee.repository');
const EmployeeService    = require('../../src/modules/employees/employee.service');
const EmployeeController = require('../../src/modules/employees/employee.controller');
const { errorHandler }   = require('../../src/middleware/errorHandler');

function buildApp(db) {
  const repo = new EmployeeRepository(db);
  const svc  = new EmployeeService(repo);
  const ctrl = new EmployeeController(svc);
  const { Router } = require('express');
  const router = Router();
  router.get('/',      ctrl.list);
  router.get('/:id',   ctrl.getById);
  router.post('/',     ctrl.create);
  router.patch('/:id', ctrl.update);
  router.delete('/:id',ctrl.remove);
  const app = express();
  app.use(express.json());
  app.use('/api/employees', router);
  app.use(errorHandler);
  return app;
}

// CPFs must match ^\d{3}\.\d{3}\.\d{3}-\d{2}$  → use numeric suffixes
const validEmployee = (n = 0) => ({
  name:       `Maria Oliveira ${n}`,
  email:      `maria${n}@empresa.com`,
  cpf:        `111.222.333-${String(n).padStart(2, '0')}`,
  department: 'RH',
  role:       'Analista',
  salary:     4500,
  hire_date:  '2023-06-01',
});

describe('Employee Routes — Integration', () => {
  let app, db;

  beforeEach(() => {
    db  = createTestDb();
    app = buildApp(db);
  });

  afterEach(() => db.close());

  // ── POST /api/employees ────────────────────────────────────────────────────
  describe('POST /api/employees', () => {
    it('201 — creates employee with valid data', async () => {
      const res = await request(app).post('/api/employees').send(validEmployee(1));
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ name: 'Maria Oliveira 1', email: 'maria1@empresa.com' });
      expect(res.body.data.id).toBeDefined();
    });

    it('400 — rejects missing required fields', async () => {
      const res = await request(app).post('/api/employees').send({ name: 'Só nome' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('400 — rejects invalid CPF format', async () => {
      const res = await request(app).post('/api/employees').send({ ...validEmployee(2), cpf: '12345678900' });
      expect(res.status).toBe(400);
    });

    it('400 — rejects invalid email', async () => {
      const res = await request(app).post('/api/employees').send({ ...validEmployee(3), email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('409 — rejects duplicate email', async () => {
      await request(app).post('/api/employees').send(validEmployee(4));
      const res = await request(app).post('/api/employees').send({ ...validEmployee(5), email: 'maria4@empresa.com' });
      expect(res.status).toBe(409);
    });

    it('409 — rejects duplicate CPF', async () => {
      await request(app).post('/api/employees').send(validEmployee(6));
      const res = await request(app).post('/api/employees').send({ ...validEmployee(7), cpf: '111.222.333-06' });
      expect(res.status).toBe(409);
    });
  });

  // ── GET /api/employees ─────────────────────────────────────────────────────
  describe('GET /api/employees', () => {
    beforeEach(async () => {
      await request(app).post('/api/employees').send(validEmployee(10));
      await request(app).post('/api/employees').send(validEmployee(11));
    });

    it('200 — returns paginated list', async () => {
      const res = await request(app).get('/api/employees');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('200 — filters by department', async () => {
      const res = await request(app).get('/api/employees?department=RH');
      expect(res.status).toBe(200);
      expect(res.body.data.every(e => e.department === 'RH')).toBe(true);
    });

    it('200 — search by name', async () => {
      const res = await request(app).get('/api/employees?search=Oliveira');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('200 — filters active employees', async () => {
      const res = await request(app).get('/api/employees?active=true');
      expect(res.status).toBe(200);
      expect(res.body.data.every(e => e.active === true)).toBe(true);
    });
  });

  // ── GET /api/employees/:id ─────────────────────────────────────────────────
  describe('GET /api/employees/:id', () => {
    it('200 — returns existing employee', async () => {
      const created = await request(app).post('/api/employees').send(validEmployee(20));
      expect(created.status).toBe(201);
      const res = await request(app).get(`/api/employees/${created.body.data.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(created.body.data.id);
    });

    it('404 — returns error for unknown id', async () => {
      const res = await request(app).get('/api/employees/9999');
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/employees/:id ───────────────────────────────────────────────
  describe('PATCH /api/employees/:id', () => {
    it('200 — updates employee fields', async () => {
      const created = await request(app).post('/api/employees').send(validEmployee(30));
      expect(created.status).toBe(201);
      const id = created.body.data.id;
      const res = await request(app).patch(`/api/employees/${id}`).send({ role: 'Gerente', salary: 9000 });
      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe('Gerente');
      expect(res.body.data.salary).toBe(9000);
    });

    it('200 — deactivates employee', async () => {
      const created = await request(app).post('/api/employees').send(validEmployee(31));
      expect(created.status).toBe(201);
      const res = await request(app).patch(`/api/employees/${created.body.data.id}`).send({ active: false });
      expect(res.status).toBe(200);
      expect(res.body.data.active).toBe(false);
    });

    it('404 — returns error for unknown id', async () => {
      const res = await request(app).patch('/api/employees/9999').send({ role: 'X' });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/employees/:id ──────────────────────────────────────────────
  describe('DELETE /api/employees/:id', () => {
    it('200 — deletes existing employee and confirms removal', async () => {
      const created = await request(app).post('/api/employees').send(validEmployee(40));
      expect(created.status).toBe(201);
      const id = created.body.data.id;

      const delRes = await request(app).delete(`/api/employees/${id}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const check = await request(app).get(`/api/employees/${id}`);
      expect(check.status).toBe(404);
    });

    it('404 — returns error for unknown id', async () => {
      const res = await request(app).delete('/api/employees/9999');
      expect(res.status).toBe(404);
    });
  });
});
