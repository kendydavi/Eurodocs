function errorHandler(err, req, res, next) {
  const status  = err.status  || 500;
  const message = err.message || 'Erro interno do servidor';
  const errors  = err.errors  || null;

  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}: ${message}`);
  }

  res.status(status).json({ success: false, message, ...(errors && { errors }) });
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: `Rota ${req.method} ${req.path} não encontrada` });
}

module.exports = { errorHandler, notFound };
