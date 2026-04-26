import { supabaseAdmin } from '../config/supabase.js'

export async function adminGetProducts(_req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function adminCreateProduct(req, res, next) {
  try {
    const {
      title,
      subtitle,
      description,
      price,
      type,
      cover_url,
      file_key,
      badge,
      status = 'draft',
      is_active = false,
      long_description,
      discount_percent,
    } = req.body

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        title,
        subtitle,
        description,
        price,
        type,
        cover_url,
        file_path: file_key,
        badge,
        status,
        is_active,
        long_description,
        discount_percent,
      })
      .select('*')
      .single()

    if (error) throw error

    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

export async function adminUpdateProduct(req, res, next) {
  try {
    const { id } = req.params

    const {
      title,
      subtitle,
      description,
      price,
      type,
      cover_url,
      file_key,
      badge,
      status,
      is_active,
      long_description,
      discount_percent,
    } = req.body

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({
        title,
        subtitle,
        description,
        price,
        type,
        cover_url,
        file_path: file_key,
        badge,
        status,
        is_active,
        updated_at: new Date().toISOString(),
        long_description,
        discount_percent,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function adminGetOrders(_req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(`
    id,
    user_id,
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
        type
      )
    )
  `)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function adminGetSummary(_req, res, next) {
  try {
    const [
      { count: productsCount, error: productsError },
      { count: ordersCount, error: ordersError },
      { count: usersCount, error: usersError },
    ] = await Promise.all([
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    ])

    if (productsError) throw productsError
    if (ordersError) throw ordersError
    if (usersError) throw usersError

    res.json({
      productsCount: productsCount || 0,
      ordersCount: ordersCount || 0,
      usersCount: usersCount || 0,
    })
  } catch (error) {
    next(error)
  }
}

export async function adminGetProductById(req, res, next) {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function adminArchiveProduct(req, res, next) {
  try {
    const { id } = req.params

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({
        is_active: false,
        status: 'archived',
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function adminGetUsers(_req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    const userIds = data.map((profile) => profile.id)

    const { data: authUsers, error: authError } =
      await supabaseAdmin.auth.admin.listUsers()

    if (authError) throw authError

    const usersWithEmail = data.map((profile) => {
      const authUser = authUsers.users.find((user) => user.id === profile.id)

      return {
        ...profile,
        email: authUser?.email || null,
      }
    })

    res.json(usersWithEmail)
  } catch (error) {
    next(error)
  }
}

export async function adminGetUserById(req, res, next) {
  try {
    const { id } = req.params

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (profileError) throw profileError

    const { data: authUserData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(id)

    if (authError) throw authError

    const { data: products, error: productsError } = await supabaseAdmin
      .from('user_products')
      .select(`
        id,
        created_at,
        product:products (
          id,
          title,
          type,
          price
        )
      `)
      .eq('user_id', id)

    if (productsError) throw productsError

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id, status, total, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    if (ordersError) throw ordersError

    res.json({
      ...profile,
      email: authUserData.user?.email || null,
      products: products || [],
      orders: orders || [],
    })
  } catch (error) {
    next(error)
  }
}

export async function adminUpdateUser(req, res, next) {
  try {
    const { id } = req.params
    const { full_name, role } = req.body

    const payload = {}

    if (full_name !== undefined) payload.full_name = full_name
    if (role !== undefined) payload.role = role

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    res.json(data)
  } catch (error) {
    next(error)
  }
}

export async function adminGrantProduct(req, res, next) {
  try {
    const { id } = req.params
    const { productId } = req.body

    if (!productId) {
      return res.status(400).json({ message: 'Falta productId' })
    }

    const { data, error } = await supabaseAdmin
      .from('user_products')
      .upsert(
        {
          user_id: id,
          product_id: productId,
          order_id: null,
        },
        {
          onConflict: 'user_id,product_id',
        }
      )
      .select('*')
      .single()

    if (error) throw error

    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

export async function adminRevokeProduct(req, res, next) {
  try {
    const { id, productId } = req.params

    const { error } = await supabaseAdmin
      .from('user_products')
      .delete()
      .eq('user_id', id)
      .eq('product_id', productId)

    if (error) throw error

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}