import { Router } from 'express'
import { getActiveBanner } from '../controllers/banners.controller.js'

const router = Router()

router.get('/active', getActiveBanner)

export default router
