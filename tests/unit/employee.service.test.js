const EmployeeService = require('../../src/modules/employees/employee.service');

// ── Mock repository ─────────────────────────────────────────────────────────
const makeMockRepo = (overrides = {}) => ({
  findAll:    jest.fn().mockReturnValue({ data: [], total: 0, page: 1, limit: 10, pages: 0 }),
  findById:   jest.fn().mockReturnValue(null),
  findByEmail:jest.fn().mockReturnValue(null),
  findByCpf:  jest.fn().mockReturnValue(null),
  create:     jest.fn(),
  update:     jest.fn(),
  delete:     jest.fn().mockReturnValue(true),
  ...overrides,
});

const validPayload = () => ({
  name: 'João Silva',
  email: 'joao@empresa.com',
  cpf: '123.456.789-00',
  department: 'TI',
  role: 'Dev',
  salary: 5000,
  hire_date: '2023-01-15',
});

const existingEmployee = () => ({ id: 1, ...validPayload(), active: true });

// ── Tests ────────────────────────────────────────────────────────────────────
describe('EmployeeService', () => {
  describe('listEmployees', () => {
    it('delega para o repositório com filtros', async () => {
      const repo = makeMockRepo();
      const svc  = new EmployeeService(repo);
      const filters = { page: 2, limit: 5 };

      await svc.listEmployees(filters);
      expect(repo.findAll).toHaveBeenCalledWith(filters);
    });
  });

  describe('getEmployee', () => {
    it('retorna funcionário ao achar', async () => {
      const employee = existingEmployee();
      const repo = makeMockRepo({ findById: jest.fn().mockReturnValue(employee) });
      const svc  = new EmployeeService(repo);

      const result = await svc.getEmployee(1);
      expect(result).toEqual(employee);
    });

    it('404 quando funcionário não é encontrado', async () => {
      const repo = makeMockRepo({ findById: jest.fn().mockReturnValue(null) });
      const svc  = new EmployeeService(repo);

      await expect(svc.getEmployee(99)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('createEmployee', () => {
    it('cria e retorna funcionário', async () => {
      const created = existingEmployee();
      const repo = makeMockRepo({ create: jest.fn().mockReturnValue(created) });
      const svc  = new EmployeeService(repo);

      const result = await svc.createEmployee(validPayload());
      expect(result).toEqual(created);
      expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it(' 400 email inválido', async () => {
      const svc = new EmployeeService(makeMockRepo());
      await expect(svc.createEmployee({ ...validPayload(), email: 'not-an-email' }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('400 CPF no formato inválido', async () => {
      const svc = new EmployeeService(makeMockRepo());
      await expect(svc.createEmployee({ ...validPayload(), cpf: '12345678900' }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('400 sal;ario negativo', async () => {
      const svc = new EmployeeService(makeMockRepo());
      await expect(svc.createEmployee({ ...validPayload(), salary: -100 }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('409 email já existente', async () => {
      const repo = makeMockRepo({ findByEmail: jest.fn().mockReturnValue(existingEmployee()) });
      const svc  = new EmployeeService(repo);

      await expect(svc.createEmployee(validPayload())).rejects.toMatchObject({ status: 409 });
    });

    it('409 CPF ja existe', async () => {
      const repo = makeMockRepo({ findByCpf: jest.fn().mockReturnValue(existingEmployee()) });
      const svc  = new EmployeeService(repo);

      await expect(svc.createEmployee(validPayload())).rejects.toMatchObject({ status: 409 });
    });

    it('400 campo obrigatório faltando', async () => {
      const svc = new EmployeeService(makeMockRepo());
      await expect(svc.createEmployee({ name: 'João' })).rejects.toMatchObject({ status: 400 });
    });

    
  });

  describe('updateEmployee', () => {
    it('atualiza funcionário', async () => {
      const employee = existingEmployee();
      const updated  = { ...employee, role: 'Tech Lead' };
      const repo = makeMockRepo({
        findById: jest.fn().mockReturnValue(employee),
        update:   jest.fn().mockReturnValue(updated),
      });
      const svc = new EmployeeService(repo);

      const result = await svc.updateEmployee(1, { role: 'Tech Lead' });
      expect(result.role).toBe('Tech Lead');
    });

    it('404 funcionário não é encontrado', async () => {
      const svc = new EmployeeService(makeMockRepo());
      await expect(svc.updateEmployee(99, { name: 'Novo' })).rejects.toMatchObject({ status: 404 });
    });

    it('409email pertence a outro funcionário', async () => {
      const employee = existingEmployee();
      const other    = { ...existingEmployee(), id: 2, email: 'outro@email.com' };
      const repo = makeMockRepo({
        findById:    jest.fn().mockReturnValue(employee),
        findByEmail: jest.fn().mockReturnValue(other),
      });
      const svc = new EmployeeService(repo);

      await expect(svc.updateEmployee(1, { email: 'outro@email.com' }))
        .rejects.toMatchObject({ status: 409 });
    });
  });

  describe('deleteEmployee', () => {
    it('deleta funcionário existente', async () => {
      const repo = makeMockRepo({ findById: jest.fn().mockReturnValue(existingEmployee()) });
      const svc  = new EmployeeService(repo);

      await expect(svc.deleteEmployee(1)).resolves.toBe(true);
      expect(repo.delete).toHaveBeenCalledWith(1);
    });

    it('404 ao deletar funcionário que nao existe', async () => {
      const svc = new EmployeeService(makeMockRepo());
      await expect(svc.deleteEmployee(99)).rejects.toMatchObject({ status: 404 });
    });
  });
});
