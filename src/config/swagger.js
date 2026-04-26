const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Employee Management API',
      version: '1.0.0',
      description: `
## API de Gerenciamento de Funcionários

Sistema completo para cadastro de funcionários e upload de documentos PDF.

### Funcionalidades
- **Funcionários**: CRUD completo com validação de CPF e e-mail únicos
- **Documentos PDF**: Upload, listagem e remoção de arquivos por funcionário
      `,
      contact: {
        name: 'Suporte Técnico',
        email: 'suporte@empresa.com',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Desenvolvimento' },
      { url: 'https://api.empresa.com', description: 'Produção' },
    ],
    components: {
      schemas: {
        Employee: {
          type: 'object',
          properties: {
            id:         { type: 'integer', example: 1 },
            name:       { type: 'string',  example: 'João Silva' },
            email:      { type: 'string',  format: 'email', example: 'joao.silva@empresa.com' },
            cpf:        { type: 'string',  example: '123.456.789-00' },
            department: { type: 'string',  example: 'Tecnologia' },
            role:       { type: 'string',  example: 'Desenvolvedor Senior' },
            salary:     { type: 'number',  example: 8500.00 },
            hire_date:  { type: 'string',  format: 'date', example: '2023-01-15' },
            active:     { type: 'boolean', example: true },
            created_at: { type: 'string',  format: 'date-time' },
            updated_at: { type: 'string',  format: 'date-time' },
          },
        },
        EmployeeInput: {
          type: 'object',
          required: ['name', 'email', 'cpf', 'department', 'role', 'salary', 'hire_date'],
          properties: {
            name:       { type: 'string',  minLength: 3,  example: 'João Silva' },
            email:      { type: 'string',  format: 'email', example: 'joao.silva@empresa.com' },
            cpf:        { type: 'string',  example: '123.456.789-00' },
            department: { type: 'string',  example: 'Tecnologia' },
            role:       { type: 'string',  example: 'Desenvolvedor Senior' },
            salary:     { type: 'number',  minimum: 0, example: 8500.00 },
            hire_date:  { type: 'string',  format: 'date', example: '2023-01-15' },
          },
        },
        PdfDocument: {
          type: 'object',
          properties: {
            id:            { type: 'integer', example: 1 },
            employee_id:   { type: 'integer', example: 1, nullable: true },
            employee_name: { type: 'string',  example: 'João Silva', nullable: true },
            filename:      { type: 'string',  example: 'doc_1700000000000.pdf' },
            original_name: { type: 'string',  example: 'contrato.pdf' },
            mimetype:      { type: 'string',  example: 'application/pdf' },
            size:          { type: 'integer', example: 204800 },
            description:   { type: 'string',  example: 'Contrato de trabalho', nullable: true },
            tags:          { type: 'array',   items: { type: 'string' }, example: ['contrato', 'rh'] },
            uploaded_at:   { type: 'string',  format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string',  example: 'Recurso não encontrado' },
            errors:  { type: 'array', items: { type: 'string' }, nullable: true },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string',  example: 'Operação realizada com sucesso' },
          },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.js'],
};

module.exports = swaggerJsdoc(options);
