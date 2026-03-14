import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import usersRouter from './routes/users'
import coursesRouter from './routes/courses'
import contentRouter from './routes/content'
import enrollmentsRouter from './routes/enrollments'
import studentRouter from './routes/student'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/users', usersRouter)
app.use('/api/courses', coursesRouter)
app.use('/api/content', contentRouter)
app.use('/api/enrollments', enrollmentsRouter)
app.use('/api/student', studentRouter)

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})
