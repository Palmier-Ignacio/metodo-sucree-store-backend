import nodemailer from 'nodemailer'
import { env } from './env.js'

let transporter = null

export function getMailerTransporter() {
  if (transporter) return transporter

  if (!env.gmailUser || !env.gmailAppPassword) {
    throw new Error('Faltan variables para enviar emails: GMAIL_USER y GMAIL_APP_PASSWORD')
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.gmailUser,
      pass: env.gmailAppPassword,
    },
  })

  return transporter
}
