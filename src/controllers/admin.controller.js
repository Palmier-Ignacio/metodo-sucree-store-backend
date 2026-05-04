import { supabaseAdmin } from '../config/supabase.js'

const REVENUE_STATUSES = ['approved', 'paid', 'completed', 'success', 'accredited']
const ORDER_STATUSES = ['pending', 'approved', 'paid', 'completed', 'success', 'accredited', 'rejected', 'cancelled', 'failure', 'refunded', 'charged_back', 'unknown']

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

function parsePositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function getPagination(query = {}) {
  const page = parsePositiveInt(query.page, 1)
  const pageSize = Math.min(parsePositiveInt(query.pageSize || query.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return { page, pageSize, from, to }
}

function paginatedResponse(rows, count, pagination) {
  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize))

  return {
    data: rows || [],
    items: rows || [],
    page: pagination.page,
    pageSize: pagination.pageSize,
    total,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPrevPage: pagination.page > 1,
  }
}


function parseDateParam(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfWeek(date) {
  const copy = new Date(date)
  const day = copy.getUTCDay() || 7
  copy.setUTCDate(copy.getUTCDate() - day + 1)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addMonths(date, months) {
  const copy = new Date(date)
  copy.setUTCMonth(copy.getUTCMonth() + months)
  return copy
}

function getRevenueRange(period, from, to) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  if (from || to) {
    const fromDate = parseDateParam(from) || addMonths(today, -1)
    const toDate = parseDateParam(to) || now
    toDate.setUTCHours(23, 59, 59, 999)
    return { fromDate, toDate }
  }

  if (period === 'week') return { fromDate: startOfWeek(today), toDate: now }
  if (period === 'year') return { fromDate: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), toDate: now }
  return { fromDate: startOfMonth(today), toDate: now }
}

function getBucketKey(date, groupBy) {
  const created = new Date(date)
  if (groupBy === 'month') return `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, '0')}`
  if (groupBy === 'week') return startOfWeek(created).toISOString().slice(0, 10)
  return created.toISOString().slice(0, 10)
}

async function validateFeaturedHomePosition({
  productId = null,
  is_featured_home,
  featured_home_order,
}) {
  const newOrder = Number(featured_home_order || 0)

  if (!is_featured_home) return

  if (![1, 2, 3].includes(newOrder)) {
    const err = new Error('La posición en home debe ser 1, 2 o 3')
    err.statusCode = 400
    throw err
  }

  // 1. buscar producto actual
  let currentProduct = null

  if (productId) {
    const { data } = await supabaseAdmin
      .from('products')
      .select('featured_home_order')
      .eq('id', productId)
      .single()

    currentProduct = data
  }

  // 2. buscar si hay otro en esa posición
  const { data: existing } = await supabaseAdmin
    .from('products')
    .select('id, featured_home_order')
    .eq('is_featured_home', true)
    .eq('featured_home_order', newOrder)
    .neq('id', productId)
    .single()

  // 3. si existe → moverlo a la posición anterior del actual
  if (existing && currentProduct?.featured_home_order) {
    await supabaseAdmin
      .from('products')
      .update({
        featured_home_order: currentProduct.featured_home_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else if (existing) {
    // caso create: lo desactiva
    await supabaseAdmin
      .from('products')
      .update({
        is_featured_home: false,
        featured_home_order: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  }
}

async function attachUsersToOrders(orders = []) {
  const userIds = [...new Set(orders.map((order) => order.user_id).filter(Boolean))]

  if (userIds.length === 0) return orders

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)

  if (error) throw error

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  )

  return orders.map((order) => {
    const profile = profileMap.get(order.user_id)

    return {
      ...order,
      user: {
        id: order.user_id,
        full_name: profile?.full_name || null,
        label: profile?.full_name || order.user_id,
      },
    }
  })
}

export async function adminGetRevenue(req, res, next) {
  try {
    const { period = 'month', from, to, groupBy = 'day', status = 'paid' } = req.query
    const { fromDate, toDate } = getRevenueRange(period, from, to)

    let query = supabaseAdmin
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
      .gte('created_at', fromDate.toISOString())
      .lte('created_at', toDate.toISOString())
      .order('created_at', { ascending: true })

    if (status !== 'all') query = query.in('status', REVENUE_STATUSES)

    const { data, error } = await query
    if (error) throw error

    const orders = data || []
    const ordersWithUsers = await attachUsersToOrders(orders)

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const paidOrdersCount = orders.length
    const averageOrderValue = paidOrdersCount ? totalRevenue / paidOrdersCount : 0
    const buckets = new Map()
    const products = new Map()

    for (const order of orders) {
      const bucketKey = getBucketKey(order.created_at, groupBy)
      const currentBucket = buckets.get(bucketKey) || {
        period: bucketKey,
        revenue: 0,
        ordersCount: 0,
      }

      currentBucket.revenue += Number(order.total || 0)
      currentBucket.ordersCount += 1
      buckets.set(bucketKey, currentBucket)

      for (const item of order.items || []) {
        const product = item.product || {}
        const productId = product.id || 'sin-producto'

        const currentProduct = products.get(productId) || {
          productId,
          title: product.title || 'Producto sin nombre',
          type: product.type || '-',
          revenue: 0,
          salesCount: 0,
        }

        currentProduct.revenue += Number(item.price || 0)
        currentProduct.salesCount += 1
        products.set(productId, currentProduct)
      }
    }

    res.json({
      filters: {
        period,
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
        groupBy,
        status,
      },
      totalRevenue,
      paidOrdersCount,
      averageOrderValue,
      timeline: Array.from(buckets.values()),
      products: Array.from(products.values()).sort((a, b) => b.revenue - a.revenue),
      orders: ordersWithUsers,
    })
  } catch (error) {
    next(error)
  }
}


export async function adminGetProducts(req, res, next) {
  try {
    const pagination = getPagination(req.query)

    const { data, error, count } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pagination.from, pagination.to)

    if (error) throw error

    res.json({
      products: data || [],
      ...paginatedResponse(data, count, pagination),
    })
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
      is_featured_home = false,
      featured_home_order = 0,
    } = req.body

    // 🔥 VALIDACIÓN
    await validateFeaturedHomePosition({
      is_featured_home,
      featured_home_order,
    })

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
        is_featured_home,
        featured_home_order,
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
      is_featured_home,
      featured_home_order,
    } = req.body

    // 🔥 VALIDACIÓN
    await validateFeaturedHomePosition({
      productId: id,
      is_featured_home,
      featured_home_order,
    })

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
        is_featured_home,
        featured_home_order,
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

export async function adminGetOrders(req, res, next) {
  try {
    const pagination = getPagination(req.query)
    const { status = 'all' } = req.query

    let query = supabaseAdmin
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
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pagination.from, pagination.to)

    if (status && status !== 'all') {
      const statuses = String(status)
        .split(',')
        .map((value) => value.trim())
        .filter((value) => ORDER_STATUSES.includes(value))

      if (statuses.length > 0) query = query.in('status', statuses)
    }

    const { data, error, count } = await query

    if (error) throw error

    const ordersWithUsers = await attachUsersToOrders(data || [])

    res.json({
      orders: ordersWithUsers,
      status,
      ...paginatedResponse(ordersWithUsers, count, pagination),
    })
  } catch (error) {
    next(error)
  }
}


export async function adminGetOrderById(req, res, next) {
  try {
    const { id } = req.params

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
            type,
            cover_url
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    const [orderWithUser] = await attachUsersToOrders(data ? [data] : [])

    res.json(orderWithUser)
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
      { data: revenueOrders, error: revenueError },
    ] = await Promise.all([
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('total').in('status', REVENUE_STATUSES),
    ])

    if (productsError) throw productsError
    if (ordersError) throw ordersError
    if (usersError) throw usersError
    if (revenueError) throw revenueError

    const revenue = (revenueOrders || []).reduce((sum, order) => sum + Number(order.total || 0), 0)

    res.json({
      productsCount: productsCount || 0,
      ordersCount: ordersCount || 0,
      usersCount: usersCount || 0,
      revenue,
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

export async function adminGetUsers(req, res, next) {
  try {
    const pagination = getPagination(req.query)

    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pagination.from, pagination.to)

    if (error) throw error

    const authResults = await Promise.all(
      (data || []).map((profile) => supabaseAdmin.auth.admin.getUserById(profile.id))
    )

    const usersWithEmail = (data || []).map((profile, index) => ({
      ...profile,
      email: authResults[index]?.data?.user?.email || null,
    }))

    res.json({
      users: usersWithEmail,
      ...paginatedResponse(usersWithEmail, count, pagination),
    })
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
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(50)

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
export async function adminGetBanners(req, res, next) {
  try {
    const pagination = getPagination(req.query)

    const { data, error, count } = await supabaseAdmin
      .from('home_banners')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pagination.from, pagination.to)

    if (error) throw error

    res.json({
      banners: data || [],
      ...paginatedResponse(data, count, pagination),
    })
  } catch (error) {
    next(error)
  }
}

export async function adminCreateBanner(req, res, next) {
  try {
    const {
      title,
      image_url,
      alt_text = null,
      link_url = null,
      is_active = false,
    } = req.body

    if (!title || !image_url) {
      return res.status(400).json({ message: 'Título e imagen son obligatorios.' })
    }

    if (is_active) {
      const { error: deactivateError } = await supabaseAdmin
        .from('home_banners')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('is_active', true)

      if (deactivateError) throw deactivateError
    }

    const { data, error } = await supabaseAdmin
      .from('home_banners')
      .insert({
        title,
        image_url,
        alt_text,
        link_url,
        is_active,
      })
      .select('*')
      .single()

    if (error) throw error

    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
}

export async function adminUpdateBanner(req, res, next) {
  try {
    const { id } = req.params
    const {
      title,
      image_url,
      alt_text,
      link_url,
      is_active,
    } = req.body

    const payload = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) payload.title = title
    if (image_url !== undefined) payload.image_url = image_url
    if (alt_text !== undefined) payload.alt_text = alt_text
    if (link_url !== undefined) payload.link_url = link_url
    if (is_active !== undefined) payload.is_active = Boolean(is_active)

    if (payload.is_active === true) {
      const { error: deactivateError } = await supabaseAdmin
        .from('home_banners')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .neq('id', id)

      if (deactivateError) throw deactivateError
    }

    const { data, error } = await supabaseAdmin
      .from('home_banners')
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

export async function adminDeleteBanner(req, res, next) {
  try {
    const { id } = req.params

    const { error } = await supabaseAdmin
      .from('home_banners')
      .delete()
      .eq('id', id)

    if (error) throw error

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}
