export async function createCheckout(_req, res) {
  res.status(501).json({
    message: 'Checkout todavía no configurado. Próximo paso: Mercado Pago Checkout Pro.',
  })
}

export async function mercadopagoWebhook(_req, res) {
  res.status(501).json({
    message: 'Webhook todavía no configurado. Próximo paso: Mercado Pago.',
  })
}
