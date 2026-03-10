import { Router } from 'express'
import { PrismaClient, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// POST /api/users — called once after signup to create the user record
router.post('/', requireAuth, async (req, res) => {
  const { role } = req.body
  const { id, email } = req.user!

  if (!role || !['TEACHER', 'STUDENT'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  try {
    const user = await prisma.user.create({
      data: {
        supabaseId: id,
        email,
        role
      }
    })

    return res.status(201).json({ user })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'User already exists' })
    }

    console.error('Error creating user:', error)
    return res.status(500).json({ error: 'Failed to create user' })
  }
})

export default router
