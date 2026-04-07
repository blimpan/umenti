import { Router } from 'express'
import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { logger } from '../lib/logger'
import { User, Role } from '@metis/types'
const router = Router()

// POST /api/users — called once after signup to create the user record
router.post('/', requireAuth, async (req, res) => {
  const { role } = req.body
  const { id, email } = req.user! as User

  if (!role || ![Role.TEACHER, Role.STUDENT].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  try {
    const user = await prisma.user.create({
      data: {
        supabaseId: id,
        email,
        role,
        ...(role === Role.TEACHER
          ? { teacherProfile: { create: {} } }
          : { studentProfile: { create: {} } }
        ),
      }
    })

    return res.status(201).json({ user })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'User already exists' })
    }

    logger.error({ err: error }, 'Error creating user')
    return res.status(500).json({ error: 'Failed to create user' })
  }
})

export default router
