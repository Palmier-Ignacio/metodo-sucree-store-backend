import { checkEmail } from '../controllers/auth.controller.js'
import { Router } from 'express'

const router = Router()

router.post('/check-email', checkEmail)

export default router