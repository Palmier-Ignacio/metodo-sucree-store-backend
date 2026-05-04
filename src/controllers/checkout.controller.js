import { env } from '../config/env.js'
import { supabaseAdmin } from '../config/supabase.js'
import { HttpError } from '../utils/httpError.js'

const PAID_STATUSES = ['approved', 'paid', 'completed', 'success', 'accredited']

function finalPrice(price, discountPercent = 0) {
  const numericPrice = Number(price || 0)
  const numericDiscount = Number(discountPercent || 0)

  if (!numericDiscount || numericDiscount <= 0) return numericPrice

  const discounted = numericPrice - (numericPrice * numericDiscount) / 100
  return Math.max(0, Math.round(discounted))
}

async function mercadopagoRequest(path, options = {}) {
  if (!env.mercadopagoAccessToken) {
    throw new HttpError(500, 'Falta configurar MERCADOPAGO_ACCESS_TOKEN.')
  }

  const res = await fetch(`https://api.mercadopago.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.mercadopagoAccessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    throw new HttpError(res.status, payload?.message || payload?.error || 'Error de Mercado Pago.')
  }

  return payload
}


async function cancelPreviousPendingOrders(userId) {
  const { error } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (error) throw error
}

async function grantAccessForOrder(orderId) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      user_id,
      created_at,
      items:order_items (
        product_id
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError) throw orderError
  if (!order) throw new HttpError(404, 'Orden no encontrada.')

  const accessRows = (order.items || [])
    .filter((item) => item.product_id)
    .map((item) => ({
      user_id: order.user_id,
      product_id: item.product_id,
      order_id: order.id,
      created_at: order.created_at,
    }))

  if (accessRows.length === 0) return

  const { error: accessError } = await supabaseAdmin
    .from('user_products')
    .upsert(accessRows, { onConflict: 'user_id,product_id' })

  if (accessError) throw accessError
}

export async function createCheckout(req, res, next) {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : []

    if (items.length === 0) {
      throw new HttpError(400, 'El carrito está vacío.')
    }

    const requestedIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))]

    if (requestedIds.length === 0) {
      throw new HttpError(400, 'No se recibieron productos válidos.')
    }

    // Bloquear compra de productos que el usuario ya tiene
    const { data: ownedProducts, error: ownedError } = await supabaseAdmin
      .from('user_products')
      .select('product_id')
      .eq('user_id', req.user.id)
      .in('product_id', requestedIds)

    if (ownedError) throw ownedError

    if (ownedProducts?.length) {
      throw new HttpError(
        400,
        'Ya tenés uno o más productos de este carrito en tu biblioteca.'
      )
    }

    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, title, price, discount_percent, status, is_active')
      .in('id', requestedIds)

    if (productsError) throw productsError

    const productMap = new Map((products || []).map((product) => [product.id, product]))

    const orderItems = requestedIds.map((productId) => {
      const product = productMap.get(productId)

      if (!product || !product.is_active || product.status !== 'published') {
        throw new HttpError(400, 'Uno de los productos no está disponible.')
      }

      const price = finalPrice(product.price, product.discount_percent)

      return {
        product,
        price,
      }
    })

    const total = orderItems.reduce((sum, item) => sum + item.price, 0)

    await cancelPreviousPendingOrders(req.user.id)

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: req.user.id,
        status: total > 0 ? 'pending' : 'paid',
        total,
        mercadopago_id: null,
      })
      .select('id, created_at')
      .single()

    if (orderError) throw orderError

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        price: item.price,
      })))

    if (itemsError) throw itemsError

    if (total <= 0) {
      await grantAccessForOrder(order.id)

      return res.status(201).json({
        order_id: order.id,
        free: true,
        init_point: `${env.frontendUrl}/success?order_id=${order.id}`,
      })
    }

    const preference = await mercadopagoRequest('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: orderItems.map((item) => ({
          id: item.product.id,
          title: item.product.title,
          quantity: 1,
          unit_price: item.price,
          currency_id: 'ARS',
        })),
        external_reference: order.id,
        metadata: {
          order_id: order.id,
          user_id: req.user.id,
        },
        payer: {
          email: req.user.email,
        },
        back_urls: {
          success: `${env.frontendUrl}/success?order_id=${order.id}`,
          failure: `${env.frontendUrl}/checkout?status=failure&order_id=${order.id}`,
          pending: `${env.frontendUrl}/checkout?status=pending&order_id=${order.id}`,
        },
        auto_return: 'approved',
        notification_url: env.mercadopagoNotificationUrl || undefined,
      }),
    })

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ mercadopago_id: preference.id })
      .eq('id', order.id)

    if (updateError) throw updateError

    res.status(201).json({
      order_id: order.id,
      preference_id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
    })
  } catch (error) {
    next(error)
  }
}

export async function mercadopagoWebhook(req, res, next) {
  try {
    const paymentId = req.body?.data?.id || req.body?.id || req.query?.['data.id']
    const type = req.body?.type || req.query?.type

    if (!paymentId || (type && type !== 'payment')) {
      return res.json({ ok: true })
    }

    const payment = await mercadopagoRequest(`/v1/payments/${paymentId}`)
    const orderId = payment.external_reference || payment.metadata?.order_id

    if (!orderId) {
      return res.json({ ok: true })
    }

    const status = payment.status || 'unknown'

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status,
        total: Math.round(Number(payment.transaction_amount || 0)),
        mercadopago_id: String(payment.id),
      })
      .eq('id', orderId)

    if (updateError) throw updateError

    if (PAID_STATUSES.includes(status)) {
      await grantAccessForOrder(orderId)
    }

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}
