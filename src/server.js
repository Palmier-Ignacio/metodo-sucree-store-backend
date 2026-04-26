import app from './app.js'
import { env, validateRequiredEnv } from './config/env.js'

validateRequiredEnv()

app.listen(env.port, () => {
  console.log(`Backend Método Sucrée escuchando en http://localhost:${env.port}`)
})
