import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'

export const timeEntriesRouter = Router()
timeEntriesRouter.use(authenticate)

timeEntriesRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { userId, projectId, taskId, date, startDate, endDate } = req.query
    const where: Record<string, unknown> = {}

    if (userId) {
      where.userId = userId
    } else if (req.userRole !== 'admin') {
      where.userId = req.userId
    }

    if (projectId) where.projectId = projectId
    if (taskId) where.taskId = taskId

    if (date) {
      const d = new Date(date as string)
      const nextDay = new Date(d)
      nextDay.setDate(nextDay.getDate() + 1)
      where.date = { gte: d, lt: nextDay }
    } else if (startDate || endDate) {
      where.date = {}
      if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate as string)
      if (endDate) {
        const end = new Date(endDate as string)
        end.setUTCHours(23, 59, 59, 999)
        ;(where.date as Record<string, unknown>).lte = end
      }
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        project: { include: { client: true } },
        task: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
    res.json(entries)
  } catch (err) { next(err) }
})

timeEntriesRouter.get('/running', async (req: AuthRequest, res, next) => {
  try {
    const entry = await prisma.timeEntry.findFirst({
      where: { userId: req.userId, isRunning: true },
      include: {
        project: { include: { client: true } },
        task: true,
      },
    })
    res.json(entry || null)
  } catch (err) { next(err) }
})

timeEntriesRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { projectId, taskId, date, hours, notes, additionalUserIds } = req.body
    const entry = await prisma.timeEntry.create({
      data: {
        userId: req.userId!,
        projectId,
        taskId,
        date: new Date(date),
        hours: parseFloat(hours),
        notes,
        isRunning: false,
      },
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        project: { include: { client: true } },
        task: true,
      },
    })

    if (Array.isArray(additionalUserIds) && additionalUserIds.length > 0) {
      await prisma.timeEntry.createMany({
        data: additionalUserIds
          .filter((uid: string) => uid !== req.userId)
          .map((uid: string) => ({
            userId: uid,
            projectId,
            taskId,
            date: new Date(date),
            hours: parseFloat(hours),
            notes,
            isRunning: false,
          })),
      })
    }

    res.status(201).json(entry)
  } catch (err) { next(err) }
})

timeEntriesRouter.post('/start', async (req: AuthRequest, res, next) => {
  try {
    // Stop any running timer first
    await prisma.timeEntry.updateMany({
      where: { userId: req.userId, isRunning: true },
      data: { isRunning: false, stoppedAt: new Date(), hours: 0 },
    })

    const { projectId, taskId, notes } = req.body
    const now = new Date()
    const today = new Date(now.toISOString().split('T')[0])
    const entry = await prisma.timeEntry.create({
      data: {
        userId: req.userId!,
        projectId,
        taskId,
        date: today,
        hours: 0,
        notes,
        startedAt: now,
        isRunning: true,
      },
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        project: { include: { client: true } },
        task: true,
      },
    })
    res.status(201).json(entry)
  } catch (err) { next(err) }
})

timeEntriesRouter.post('/stop/:id', async (req: AuthRequest, res, next) => {
  try {
    const entry = await prisma.timeEntry.findUnique({ where: { id: req.params.id } })
    if (!entry || !entry.isRunning || !entry.startedAt) {
      return res.status(400).json({ error: 'Timer not running' })
    }

    const now = new Date()
    const hours = (now.getTime() - entry.startedAt.getTime()) / 3600000

    const updated = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data: { isRunning: false, stoppedAt: now, hours: Math.round(hours * 100) / 100 },
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        project: { include: { client: true } },
        task: true,
      },
    })
    res.json(updated)
  } catch (err) { next(err) }
})

timeEntriesRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { projectId, taskId, date, hours, notes } = req.body
    const data: Record<string, unknown> = {}
    if (projectId) data.projectId = projectId
    if (taskId) data.taskId = taskId
    if (date) data.date = new Date(date)
    if (hours !== undefined) data.hours = parseFloat(hours)
    if (notes !== undefined) data.notes = notes

    const entry = await prisma.timeEntry.update({
      where: { id: req.params.id },
      data,
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        project: { include: { client: true } },
        task: true,
      },
    })
    res.json(entry)
  } catch (err) { next(err) }
})

timeEntriesRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.timeEntry.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})
