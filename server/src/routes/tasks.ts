import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

export const tasksRouter = Router()
tasksRouter.use(authenticate)

tasksRouter.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.query
    const where: Record<string, unknown> = { isActive: true }
    if (projectId) where.projectId = projectId
    const tasks = await prisma.task.findMany({
      where,
      include: { project: { include: { client: true } } },
      orderBy: { name: 'asc' },
    })
    res.json(tasks)
  } catch (err) { next(err) }
})

tasksRouter.post('/', async (req, res, next) => {
  try {
    const task = await prisma.task.create({
      data: req.body,
      include: { project: true },
    })
    res.status(201).json(task)
  } catch (err) { next(err) }
})

tasksRouter.patch('/:id', async (req, res, next) => {
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json(task)
  } catch (err) { next(err) }
})

tasksRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})
