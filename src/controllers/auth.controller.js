import { supabaseAdmin } from '../config/supabase.js'

export async function checkEmail(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()

    if (!email) {
      return res.status(400).json({
        message: 'Email requerido.',
      })
    }

    const { data, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) throw error

    const exists = data.users.some(
      (user) => user.email?.toLowerCase() === email
    )

    return res.json({ exists })
  } catch (error) {
    next(error)
  }
}