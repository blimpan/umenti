import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import usersRouter from './routes/users'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/users', usersRouter)

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})
