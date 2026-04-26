const { z } = require('zod');
const EmployeeRepository = require('./employee.repository');

const employeeSchema = z.object({
  name:       z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email:      z.string().email('E-mail inválido'),
  cpf:        z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido (formato: 000.000.000-00)'),
  department: z.string().min(1, 'Departamento obrigatório'),
  role:       z.string().min(1, 'Cargo obrigatório'),
  salary:     z.number().positive('Salário deve ser positivo'),
  hire_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (formato: YYYY-MM-DD)'),
});

const updateSchema = employeeSchema.partial().extend({
  active: z.boolean().optional(),
});

class EmployeeService {
  constructor(repository) {
    this.repo = repository || new EmployeeRepository();
  }

  async listEmployees(filters) {
    return this.repo.findAll(filters);
  }

  async getEmployee(id) {
    const employee = this.repo.findById(id);
    if (!employee) throw Object.assign(new Error('Funcionário não encontrado'), { status: 404 });
    return employee;
  }

  async createEmployee(data) {
    const parsed = this._validate(employeeSchema, data);

    if (this.repo.findByEmail(parsed.email)) {
      throw Object.assign(new Error('E-mail já cadastrado'), { status: 409 });
    }
    if (this.repo.findByCpf(parsed.cpf)) {
      throw Object.assign(new Error('CPF já cadastrado'), { status: 409 });
    }

    return this.repo.create(parsed);
  }

  async updateEmployee(id, data) {
    await this.getEmployee(id);
    const parsed = this._validate(updateSchema, data);

    if (parsed.email) {
      const existing = this.repo.findByEmail(parsed.email);
      if (existing && existing.id !== id) {
        throw Object.assign(new Error('E-mail já em uso'), { status: 409 });
      }
    }
    if (parsed.cpf) {
      const existing = this.repo.findByCpf(parsed.cpf);
      if (existing && existing.id !== id) {
        throw Object.assign(new Error('CPF já em uso'), { status: 409 });
      }
    }

    return this.repo.update(id, parsed);
  }

  async deleteEmployee(id) {
    await this.getEmployee(id);
    return this.repo.delete(id);
  }

  _validate(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw Object.assign(new Error('Dados inválidos'), { status: 400, errors });
    }
    return result.data;
  }
}

module.exports = EmployeeService;
