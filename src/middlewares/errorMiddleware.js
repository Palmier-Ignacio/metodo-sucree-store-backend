export function notFoundMiddleware(req, _res, next) {
  const error = new Error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`)
  error.statusCode = 404
  next(error)
}

export function errorMiddleware(error, _req, res, _next) {
  const statusCode = error.statusCode || 500

  res.status(statusCode).json({
    message: error.message || 'Error interno del servidor',
  })
}
