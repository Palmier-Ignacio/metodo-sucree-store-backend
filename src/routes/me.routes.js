import { Router } from 'express'
import { getMyLibrary, getMyOrders, getMyProfile, requestDownload } from '../controllers/me.controller.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = Router()

router.use(requireAuth)

router.get('/profile', getMyProfile)
router.get('/library', getMyLibrary)
router.get('/orders', getMyOrders)
router.post('/library/:productId/download', requestDownload)
router.post('/download/:productId', requestDownload)

export default router
