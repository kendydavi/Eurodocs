const { Router } = require('express');
const EmployeeController = require('./employee.controller');

const router = Router();
const ctrl = new EmployeeController();

/**
 * @swagger
 * tags:
 *   name: Funcionários
 *   description: Cadastro e gerenciamento de funcionários
 */

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Listar funcionários
 *     tags: [Funcionários]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Página
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Itens por página (máx 100)
 *       - in: query
 *         name: department
 *         schema: { type: string }
 *         description: Filtrar por departamento
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *         description: Filtrar por status ativo/inativo
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Buscar por nome, e-mail ou cargo
 *     responses:
 *       200:
 *         description: Lista paginada de funcionários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Employee' }
 *                 total: { type: integer, example: 42 }
 *                 page:  { type: integer, example: 1 }
 *                 limit: { type: integer, example: 10 }
 *                 pages: { type: integer, example: 5 }
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     summary: Buscar funcionário por ID
 *     tags: [Funcionários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Funcionário encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Employee' }
 *       404:
 *         description: Não encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', ctrl.getById);

/**
 * @swagger
 * /api/employees:
 *   post:
 *     summary: Cadastrar novo funcionário
 *     tags: [Funcionários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EmployeeInput' }
 *     responses:
 *       201:
 *         description: Funcionário criado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/Employee' }
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: E-mail ou CPF já cadastrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', ctrl.create);

/**
 * @swagger
 * /api/employees/{id}:
 *   patch:
 *     summary: Atualizar funcionário
 *     tags: [Funcionários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/EmployeeInput'
 *               - type: object
 *                 properties:
 *                   active: { type: boolean }
 *     responses:
 *       200:
 *         description: Funcionário atualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Employee' }
 *       404:
 *         description: Não encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', ctrl.update);

/**
 * @swagger
 * /api/employees/{id}:
 *   delete:
 *     summary: Remover funcionário
 *     tags: [Funcionários]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Funcionário removido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Success' }
 *       404:
 *         description: Não encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', ctrl.remove);

module.exports = router;
