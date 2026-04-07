import { PrismaClient } from '@prisma/client'
import { prismaLogger } from './logger'

const prisma = new PrismaClient({
  log: [{ emit: 'event', level: 'query' }],
})

prisma.$on('query', (e) => {
  prismaLogger.info({ duration: e.duration, query: e.query.slice(0, 120) }, 'query')
})

export default prisma
