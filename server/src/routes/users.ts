import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth'

export const usersRouter = Router()
usersRouter.use(authenticate)

usersRouter.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true, avatarColor: true, defaultTask: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    res.json(users)
  } catch (err) { next(err) }
})

usersRouter.patch('/profile', async (req: AuthRequest, res, next) => {
  try {
    const { name, email, password, currentPassword, avatarColor, defaultTask } = req.body
    const data: Record<string, unknown> = {}
    if (name) data.name = name
    if (email) data.email = email
    if (avatarColor) data.avatarColor = avatarColor
    if (defaultTask !== undefined) data.defaultTask = defaultTask

    if (password) {
      if (!currentPassword) return res.status(400).json({ error: 'Current password is required to set a new password' })
      const existing = await prisma.user.findUnique({ where: { id: req.userId }, select: { password: true } })
      if (!existing) return res.status(404).json({ error: 'User not found' })
      const valid = await bcrypt.compare(currentPassword, existing.password)
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' })
      data.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: { id: true, name: true, email: true, role: true, avatarColor: true, defaultTask: true, createdAt: true },
    })
    res.json(user)
  } catch (err) { next(err) }
})

usersRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role = 'member', avatarColor } = req.body
    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role, avatarColor: avatarColor || '#6366f1' },
      select: { id: true, name: true, email: true, role: true, avatarColor: true, createdAt: true },
    })
    res.status(201).json(user)
  } catch (err) { next(err) }
})

usersRouter.delete('/:id', requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    if (req.params.id === req.userId) return res.status(400).json({ error: 'Cannot deactivate yourself' })
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    res.status(204).send()
  } catch (err) { next(err) }
})
