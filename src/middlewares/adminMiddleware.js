import { HttpError } from '../utils/httpError.js'

export function requireAdmin(req, _res, next) {
  if (req.profile?.role !== 'admin') {
    return next(new HttpError(403, 'Acceso denegado. Se requiere rol admin.'))
  }

  next()
}
