import { supabaseAuth, supabaseAdmin } from '../config/supabase.js'
import { HttpError } from '../utils/httpError.js'

export async function requireAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null

    if (!token) {
      throw new HttpError(401, 'No autorizado. Falta token de sesión.')
    }

    const { data, error } = await supabaseAuth.auth.getUser(token)

    if (error || !data?.user) {
      throw new HttpError(401, 'Sesión inválida o expirada.')
    }

    req.user = data.user

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      throw new HttpError(403, 'No se pudo cargar el perfil del usuario.')
    }

    req.profile = profile
    next()
  } catch (error) {
    next(error)
  }
}
