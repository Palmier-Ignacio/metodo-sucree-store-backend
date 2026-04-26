import { supabaseAdmin } from '../config/supabase.js'
import { HttpError } from '../utils/httpError.js'

export async function getProducts(_req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, title, subtitle, description, price, type, cover_url, badge, status, is_active, created_at, discount_percent')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function getProductById(req, res, next) {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, title, subtitle, description, price, type, cover_url, badge, status, is_active, created_at, long_description, discount_percent')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error || !data) {
      throw new HttpError(404, 'Producto no encontrado.')
    }

    res.json(data)
  } catch (error) {
    next(error)
  }
}
