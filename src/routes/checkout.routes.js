import { Router } from 'express'
import { createCheckout, mercadopagoWebhook, syncCheckoutOrder } from '../controllers/checkout.controller.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = Router()

router.post('/', requireAuth, createCheckout)
router.post('/create-preference', requireAuth, createCheckout)
router.post('/sync/:orderId', requireAuth, syncCheckoutOrder)
router.post('/webhook/mercadopago', mercadopagoWebhook)

export default router
