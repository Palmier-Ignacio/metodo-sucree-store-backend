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
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(30),
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
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(30)

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

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('title, file_path')
      .eq('id', productId)
      .single()

    if (productError) throw productError

    if (!product?.file_path) {
      throw new HttpError(404, 'Archivo no configurado.')
    }

    res.json({
      url: product.file_path,
      title: product.title,
    })
  } catch (error) {
    next(error)
  }
}
