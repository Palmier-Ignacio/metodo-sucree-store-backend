import { Router } from 'express'
import {
  adminArchiveProduct,
  adminCreateProduct,
  adminGetOrders,
  adminGetProductById,
  adminGetProducts,
  adminGetSummary,
  adminGetUserById,
  adminGetUsers,
  adminGrantProduct,
  adminRevokeProduct,
  adminUpdateProduct,
  adminUpdateUser,
} from '../controllers/admin.controller.js'
import { requireAdmin } from '../middlewares/adminMiddleware.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

router.get('/users', adminGetUsers)
router.get('/users/:id', adminGetUserById)
router.put('/users/:id', adminUpdateUser)
router.post('/users/:id/products', adminGrantProduct)
router.delete('/users/:id/products/:productId', adminRevokeProduct)
router.delete('/products/:id', adminArchiveProduct)
router.get('/summary', adminGetSummary)
router.get('/products', adminGetProducts)
router.post('/products', adminCreateProduct)
router.get('/products/:id', adminGetProductById)
router.put('/products/:id', adminUpdateProduct)
router.get('/orders', adminGetOrders)

export default router
