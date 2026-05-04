import { Router } from 'express'
import {
  adminCreateBanner,
  adminDeleteBanner,
  adminArchiveProduct,
  adminCreateProduct,
  adminGetBanners,
  adminGetOrders,
  adminGetOrderById,
  adminGetProductById,
  adminGetProducts,
  adminGetRevenue,
  adminGetSummary,
  adminGetUserById,
  adminGetUsers,
  adminGrantProduct,
  adminRevokeProduct,
  adminUpdateProduct,
  adminUpdateBanner,
  adminUpdateUser,
} from '../controllers/admin.controller.js'
import { requireAdmin } from '../middlewares/adminMiddleware.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

router.get('/banners', adminGetBanners)
router.post('/banners', adminCreateBanner)
router.put('/banners/:id', adminUpdateBanner)
router.delete('/banners/:id', adminDeleteBanner)

router.get('/users', adminGetUsers)
router.get('/users/:id', adminGetUserById)
router.put('/users/:id', adminUpdateUser)
router.post('/users/:id/products', adminGrantProduct)
router.delete('/users/:id/products/:productId', adminRevokeProduct)
router.delete('/products/:id', adminArchiveProduct)
router.get('/summary', adminGetSummary)
router.get('/revenue', adminGetRevenue)
router.get('/products', adminGetProducts)
router.post('/products', adminCreateProduct)
router.get('/products/:id', adminGetProductById)
router.put('/products/:id', adminUpdateProduct)
router.get('/orders', adminGetOrders)
router.get('/orders/:id', adminGetOrderById)

export default router
