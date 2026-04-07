import pino from 'pino'
import path from 'path'
import fs from 'fs'

const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

// General logger — HTTP requests, auth, route errors → stdout (tmux pane 2)
export const logger = pino({ level: 'info' })

// LLM logger — course generation pipeline → logs/llm.log (tmux pane 3)
export const llmLogger = pino(
  { level: 'info' },
  pino.destination(path.join(logsDir, 'llm.log'))
)

// Prisma logger — database queries → logs/prisma.log (tmux pane 4)
export const prismaLogger = pino(
  { level: 'info' },
  pino.destination(path.join(logsDir, 'prisma.log'))
)
