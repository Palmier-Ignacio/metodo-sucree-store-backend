import { Router } from 'express'
import { createCheckout, mercadopagoWebhook } from '../controllers/checkout.controller.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = Router()

router.post('/', requireAuth, createCheckout)
router.post('/create-preference', requireAuth, createCheckout)
router.post('/webhook/mercadopago', mercadopagoWebhook)

export default router
