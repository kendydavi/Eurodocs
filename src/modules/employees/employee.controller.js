const EmployeeService = require('./employee.service');

class EmployeeController {
  constructor(service) {
    this.service = service || new EmployeeService();
  }

  list = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, department, active, search } = req.query;
      const filters = {
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100),
        department,
        search,
        active: active !== undefined ? active === 'true' : undefined,
      };
      const result = await this.service.listEmployees(filters);
      res.json({ success: true, ...result });
    } catch (err) { next(err); }
  };

  getById = async (req, res, next) => {
    try {
      const employee = await this.service.getEmployee(parseInt(req.params.id, 10));
      res.json({ success: true, data: employee });
    } catch (err) { next(err); }
  };

  create = async (req, res, next) => {
    try {
      const employee = await this.service.createEmployee(req.body);
      res.status(201).json({ success: true, message: 'Funcionário cadastrado com sucesso', data: employee });
    } catch (err) { next(err); }
  };

  update = async (req, res, next) => {
    try {
      const employee = await this.service.updateEmployee(parseInt(req.params.id, 10), req.body);
      res.json({ success: true, message: 'Funcionário atualizado com sucesso', data: employee });
    } catch (err) { next(err); }
  };

  remove = async (req, res, next) => {
    try {
      await this.service.deleteEmployee(parseInt(req.params.id, 10));
      res.json({ success: true, message: 'Funcionário removido com sucesso' });
    } catch (err) { next(err); }
  };
}

module.exports = EmployeeController;
