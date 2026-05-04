import { supabaseAdmin } from '../config/supabase.js'

export async function getActiveBanner(_req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('home_banners')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    res.json(data || null)
  } catch (error) {
    next(error)
  }
}
