const { getDatabase } = require('../../config/database');

class EmployeeRepository {
  constructor(db) {
    this.db = db || getDatabase();
  }

  findAll({ page = 1, limit = 10, department, active, search } = {}) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (department) { conditions.push('department = ?'); params.push(department); }
    if (active !== undefined) { conditions.push('active = ?'); params.push(active ? 1 : 0); }
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR role LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = this.db.prepare(`SELECT COUNT(*) as count FROM employees ${where}`).get(...params).count;
    const rows  = this.db.prepare(`SELECT * FROM employees ${where} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    return { data: rows.map(this._normalize), total, page, limit, pages: Math.ceil(total / limit) };
  }

  findById(id) {
    const row = this.db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    return row ? this._normalize(row) : null;
  }

  findByEmail(email) {
    const row = this.db.prepare('SELECT * FROM employees WHERE email = ?').get(email);
    return row ? this._normalize(row) : null;
  }

  findByCpf(cpf) {
    const row = this.db.prepare('SELECT * FROM employees WHERE cpf = ?').get(cpf);
    return row ? this._normalize(row) : null;
  }

  create({ name, email, cpf, department, role, salary, hire_date }) {
    const stmt = this.db.prepare(`
      INSERT INTO employees (name, email, cpf, department, role, salary, hire_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, email, cpf, department, role, salary, hire_date);
    return this.findById(result.lastInsertRowid);
  }

  update(id, fields) {
    const allowed = ['name', 'email', 'cpf', 'department', 'role', 'salary', 'hire_date', 'active'];
    const updates = Object.keys(fields).filter(k => allowed.includes(k));
    if (!updates.length) return this.findById(id);

    const set = updates.map(k => `${k} = ?`).join(', ');
    const values = updates.map(k => k === 'active' ? (fields[k] ? 1 : 0) : fields[k]);

    this.db.prepare(`UPDATE employees SET ${set}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
    return this.findById(id);
  }

  delete(id) {
    return this.db.prepare('DELETE FROM employees WHERE id = ?').run(id).changes > 0;
  }

  _normalize(row) {
    return { ...row, active: row.active === 1 };
  }
}

module.exports = EmployeeRepository;
