import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import { logger } from './lib/logger'
import { initJWKS } from './middleware/auth'
import usersRouter from './routes/users'
import coursesRouter from './routes/courses'
import contentRouter from './routes/content'
import enrollmentsRouter from './routes/enrollments'
import studentRouter from './routes/student'
import sessionRouter from './routes/session'
import wizardRouter from './routes/wizard'
import templatesRouter from './routes/templates'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use((req, _res, next) => {
  const start = Date.now()
  _res.on('finish', () => {
    const ms = Date.now() - start
    logger.info({ method: req.method, path: req.path, status: _res.statusCode, ms }, 'request')
  })
  next()
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/users', usersRouter)
app.use('/api/courses', coursesRouter)
app.use('/api/content', contentRouter)
app.use('/api/enrollments', enrollmentsRouter)
app.use('/api/student', studentRouter)
app.use('/api/student/courses/:courseId/modules/:moduleId/session', sessionRouter)
app.use('/api/wizard', wizardRouter)
app.use('/api/templates', templatesRouter)

initJWKS().then(() => {
  app.listen(PORT, () => {
    logger.info({ port: PORT }, `API running on http://localhost:${PORT}`)
  })
}).catch(err => {
  logger.error({ err }, 'JWKS init failed')
  process.exit(1)
})
