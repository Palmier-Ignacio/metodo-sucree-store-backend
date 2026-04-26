import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { errorMiddleware, notFoundMiddleware } from './middlewares/errorMiddleware.js'
import adminRoutes from './routes/admin.routes.js'
import checkoutRoutes from './routes/checkout.routes.js'
import meRoutes from './routes/me.routes.js'
import productsRoutes from './routes/products.routes.js'

const app = express()

app.use(helmet())
app.use(cors({ origin: env.frontendUrl, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'metodo-sucree-backend' })
})

app.use('/api/products', productsRoutes)
app.use('/api/me', meRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/checkout', checkoutRoutes)

app.use(notFoundMiddleware)
app.use(errorMiddleware)

export default app
