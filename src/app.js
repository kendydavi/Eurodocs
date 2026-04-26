require('dotenv').config();

const express        = require('express');
const cors           = require('cors');
const path           = require('path');
const swaggerUi      = require('swagger-ui-express');
const swaggerSpec    = require('./config/swagger');
const employeeRoutes = require('./modules/employees/employee.routes');
const uploadRoutes   = require('./modules/uploads/upload.routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_, res) => res.redirect('/cadastro'));
app.get('/cadastro', (_, res) => res.sendFile(path.join(__dirname, 'public', 'cadastro.html')));
app.get('/arquivos', (_, res) => res.sendFile(path.join(__dirname, 'public', 'arquivos.html')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Employee Management API',
  swaggerOptions: { persistAuthorization: true },
}));
app.get('/api-docs.json', (_, res) => res.json(swaggerSpec));

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/employees', employeeRoutes);
app.use('/api/uploads',   uploadRoutes);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server:    http://localhost:${PORT}`);
    console.log(`👤 Cadastro:  http://localhost:${PORT}/cadastro`);
    console.log(`📁 Arquivos:  http://localhost:${PORT}/arquivos`);
    console.log(`📚 Swagger:   http://localhost:${PORT}/api-docs`);
  });
}

module.exports = app;
