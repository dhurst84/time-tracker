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
      select: { id: true, name: true, email: true, role: true, avatarColor: true, defaultTask: true, weeklyCapacity: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    res.json(users)
  } catch (err) { next(err) }
})

usersRouter.get('/utilization', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate required' })

    const start = new Date(startDate as string)
    const end = new Date(endDate as string)

    // Get all active users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })

    // Get all time entries in range with task billable info
    const entries = await prisma.timeEntry.findMany({
      where: {
        date: { gte: start, lte: end },
        user: { isActive: true },
      },
      include: { task: { select: { isBillable: true } } },
    })

    // Calculate number of weeks in range
    const msPerWeek = 7 * 24 * 60 * 60 * 1000
    const weeks = Math.max(1, (end.getTime() - start.getTime()) / msPerWeek)

    // Aggregate per user
    const statsMap = new Map<string, { hoursLogged: number; billableHours: number }>()
    for (const entry of entries) {
      const existing = statsMap.get(entry.userId) ?? { hoursLogged: 0, billableHours: 0 }
      existing.hoursLogged += entry.hours
      if (entry.task?.isBillable) existing.billableHours += entry.hours
      statsMap.set(entry.userId, existing)
    }

    const result = users.map(u => {
      const stats = statsMap.get(u.id) ?? { hoursLogged: 0, billableHours: 0 }
      const capacityHours = u.weeklyCapacity * weeks
      const utilizationPct = capacityHours > 0 ? (stats.hoursLogged / capacityHours) * 100 : 0
      const billablePct = stats.hoursLogged > 0 ? (stats.billableHours / stats.hoursLogged) * 100 : 0
      return {
        userId: u.id,
        name: u.name,
        avatarColor: u.avatarColor,
        weeklyCapacity: u.weeklyCapacity,
        hoursLogged: stats.hoursLogged,
        billableHours: stats.billableHours,
        nonBillableHours: stats.hoursLogged - stats.billableHours,
        capacityHours,
        utilizationPct,
        billablePct,
      }
    })

    res.json(result)
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
      select: { id: true, name: true, email: true, role: true, avatarColor: true, defaultTask: true, weeklyCapacity: true, createdAt: true },
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
      select: { id: true, name: true, email: true, role: true, avatarColor: true, weeklyCapacity: true, createdAt: true },
    })
    res.status(201).json(user)
  } catch (err) { next(err) }
})

usersRouter.patch('/:id', requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { weeklyCapacity } = req.body
    const data: Record<string, unknown> = {}
    if (weeklyCapacity !== undefined) data.weeklyCapacity = weeklyCapacity

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, avatarColor: true, defaultTask: true, weeklyCapacity: true, createdAt: true },
    })
    res.json(user)
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
