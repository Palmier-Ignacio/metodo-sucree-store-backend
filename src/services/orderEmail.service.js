import { resend } from '../config/resend.js'
import { env } from '../config/env.js'

function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(value))
}

export async function sendOrderConfirmationEmail(order) {
  if (!env.resendApiKey) return

  const buyerEmail = order.buyer_email

  if (!buyerEmail) return

  const items = order.items || []

  const itemsHtml = items
    .map((item) => {
      const title = item.product?.title || 'Ebook'
      const price = formatCurrency(item.price)

      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #eadfdc;">
            ${title}
          </td>
          <td style="padding:12px;border-bottom:1px solid #eadfdc;text-align:right;">
            ${price}
          </td>
        </tr>
      `
    })
    .join('')

  await resend.emails.send({
    from: 'Método Sucrée <noreply@metodosucree.com>',
    to: [buyerEmail],
    subject: 'Tu compra en Método Sucrée fue confirmada',
    html: `
      <div style="margin:0;padding:0;background:#f7f3f0;font-family:Arial,sans-serif;color:#4A2E2B;">
        <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
          <div style="background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(198,167,105,.35);">
            
            <div style="background:#D8A7B1;padding:26px 30px;text-align:center;">
              <h1 style="margin:0;color:#4A2E2B;font-size:26px;">
                Compra confirmada
              </h1>
              <p style="margin:10px 0 0;color:#4A2E2B;font-size:14px;">
                Ya podés acceder a tus ebooks.
              </p>
            </div>

            <div style="padding:30px;">
              <p style="margin-top:0;font-size:16px;">
                Hola, recibimos correctamente tu compra.
              </p>

              <p style="font-size:14px;color:#8C7A73;">
                Orden: <strong>${order.id}</strong><br />
                Fecha: <strong>${formatDate(order.created_at)}</strong>
              </p>

              <table style="width:100%;border-collapse:collapse;margin:24px 0;">
                <thead>
                  <tr>
                    <th style="padding:12px;text-align:left;background:#fffaf8;border-bottom:1px solid #eadfdc;">
                      Ebook
                    </th>
                    <th style="padding:12px;text-align:right;background:#fffaf8;border-bottom:1px solid #eadfdc;">
                      Precio
                    </th>
                  </tr>
                </thead>

                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <p style="font-size:18px;text-align:right;">
                Total: <strong>${formatCurrency(order.total)}</strong>
              </p>

              <div style="margin-top:28px;text-align:center;">
              <p style="margin-bottom:12px;font-size:16px;color:#8C7A73;text-align:center;">
                Para acceder al Ebook debés ingresar a "Mi biblioteca"
              </p>
                <a
                  href="${env.frontendUrl}/biblioteca"
                  style="display:inline-block;padding:14px 24px;border-radius:999px;background:#D8A7B1;color:#4A2E2B;text-decoration:none;font-weight:bold;"
                >
                  Ver mis ebooks
                </a>
              </div>

                
              

              <p style="margin-top:24px;font-size:13px;color:#8C7A73;text-align:center;">
                Si el botón no funciona, ingresá a tu cuenta desde ${env.frontendUrl}
              </p>
            </div>
          </div>
        </div>
      </div>
    `,
  })
}