import { supabaseAdmin } from '../config/supabase.js'
import { HttpError } from '../utils/httpError.js'

export async function getMyProfile(req, res) {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
    },
    profile: req.profile,
  })
}

export async function getMyLibrary(req, res, next) {
  try {
    const [libraryResponse, ordersResponse] = await Promise.all([
      supabaseAdmin
        .from('user_products')
        .select(`
          id,
          created_at,
          product:products (
            id,
            title,
            description,
            price,
            type,
            cover_url
          )
        `)
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('orders')
        .select('id, status, total, mercadopago_id, created_at')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false }),
    ])

    if (libraryResponse.error) throw libraryResponse.error
    if (ordersResponse.error) throw ordersResponse.error

    const products = (libraryResponse.data || [])
      .map((item) => ({
        ...item.product,
        access_id: item.id,
        unlocked_at: item.created_at,
      }))
      .filter((product) => product.id)

    res.json({
      products,
      library: products,
      orders: ordersResponse.data || [],
    })
  } catch (error) {
    next(error)
  }
}

export async function getMyOrders(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id,
        status,
        total,
        mercadopago_id,
        created_at,
        items:order_items (
          id,
          price,
          product:products (
            id,
            title,
            type,
            cover_url
          )
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(data || [])
  } catch (error) {
    next(error)
  }
}

export async function requestDownload(req, res, next) {
  try {
    const { productId } = req.params

    const { data: access, error: accessError } = await supabaseAdmin
      .from('user_products')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('product_id', productId)
      .maybeSingle()

    if (accessError) throw accessError

    if (!access) {
      throw new HttpError(403, 'No tenés acceso a este producto.')
    }

    res.status(501).json({
      message: 'Descargas todavía no configuradas. Próximo paso: Cloudflare R2.',
    })
  } catch (error) {
    next(error)
  }
}
