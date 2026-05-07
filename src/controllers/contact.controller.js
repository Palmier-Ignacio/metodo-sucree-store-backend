import { env } from '../config/env.js'
import { resend } from '../config/resend.js'

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function isValidEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function sendContactMessage(req, res, next) {
  try {
    const { firstName, lastName, email, subject, message } = req.body

    if (!firstName || !lastName || !email || !subject || !message) {
      return res.status(400).json({
        message: 'Todos los campos son obligatorios.',
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: 'El correo electrónico no es válido.',
      })
    }

    const fullName = `${firstName} ${lastName}`.trim()

    const safeFullName = escapeHtml(fullName)
    const safeEmail = escapeHtml(email)
    const safeSubject = escapeHtml(subject)
    const safeMessage = escapeHtml(message).replaceAll('\n', '<br />')

    await resend.emails.send({
      from: 'Método Sucree <noreply@metodosucree.com>',

      to: [env.contactReceiverEmail],

      replyTo: `${fullName} <${email}>`,

      subject: `Nuevo contacto web - ${subject}`,

      html: `
  <div style="margin:0;padding:0;background:#f7f3f0;font-family:Arial,sans-serif;color:#4A2E2B;">
    <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
      
      <div style="background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(198,167,105,.35);box-shadow:0 12px 36px rgba(74,46,43,.10);">
        
        <div style="background:#D8A7B1;padding:26px 30px;text-align:center;">
          <h1 style="margin:0;color:#4A2E2B;font-size:28px;line-height:1.2;">
            Nuevo mensaje desde la web
          </h1>

          <p style="margin:10px 0 0;color:#4A2E2B;font-size:14px;">
            Recibiste una consulta desde el formulario de contacto
          </p>
        </div>

        <div style="padding:30px;">
          
          <div style="margin-bottom:22px;padding:18px;border-radius:18px;background:#fffaf8;border:1px solid rgba(198,167,105,.25);">
            <p style="margin:0 0 6px;color:#8C7A73;font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:bold;">
              Persona
            </p>

            <p style="margin:0;color:#4A2E2B;font-size:18px;font-weight:bold;">
              ${safeFullName}
            </p>
          </div>

          <div style="display:grid;gap:14px;margin-bottom:22px;">
            <div style="padding:16px;border-radius:16px;background:#F7F3F0;">
              <p style="margin:0 0 6px;color:#8C7A73;font-size:12px;font-weight:bold;text-transform:uppercase;">
                Email
              </p>

              <p style="margin:0;color:#4A2E2B;font-size:15px;">
                ${safeEmail}
              </p>
            </div>

            <div style="padding:16px;border-radius:16px;background:#F7F3F0;">
              <p style="margin:0 0 6px;color:#8C7A73;font-size:12px;font-weight:bold;text-transform:uppercase;">
                Asunto
              </p>

              <p style="margin:0;color:#4A2E2B;font-size:16px;font-weight:bold;">
                ${safeSubject}
              </p>
            </div>
          </div>

          <div style="padding:22px;border-radius:20px;background:#ffffff;border:1px solid rgba(198,167,105,.35);">
            <p style="margin:0 0 12px;color:#8C7A73;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;">
              Mensaje
            </p>

            <div style="color:#4A2E2B;font-size:16px;line-height:1.7;white-space:pre-line;">
              ${safeMessage}
            </div>
          </div>

          <div style="margin-top:28px;text-align:center;">
            <a
              href="mailto:${safeEmail}"
              style="display:inline-block;padding:14px 24px;border-radius:999px;background:#D8A7B1;color:#4A2E2B;text-decoration:none;font-weight:bold;"
            >
              Responder a ${safeFullName}
            </a>
          </div>

        </div>

        <div style="padding:18px 30px;background:#fffaf8;border-top:1px solid rgba(198,167,105,.25);text-align:center;">
          <p style="margin:0;color:#8C7A73;font-size:12px;">
            Este correo fue enviado automáticamente desde el formulario de contacto de la web.
          </p>
        </div>

      </div>
    </div>
  </div>
`,
    })

    return res.status(200).json({
      ok: true,
      message: 'Mensaje enviado correctamente.',
    })
  } catch (error) {
    console.error(error)
    next(error)
  }
}