import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

export const clientsRouter = Router()
clientsRouter.use(authenticate)

clientsRouter.get('/', async (req, res, next) => {
  try {
    const { includeArchived } = req.query
    const clients = await prisma.client.findMany({
      where: includeArchived === 'true' ? {} : { isActive: true },
      include: { group: true, _count: { select: { projects: true } } },
      orderBy: { name: 'asc' },
    })
    res.json(clients)
  } catch (err) { next(err) }
})

clientsRouter.get('/:id', async (req, res, next) => {
  try {
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        group: true,
        projects: {
          where: { isActive: true },
          include: { tasks: true, _count: { select: { timeEntries: true } } },
        },
      },
    })
    if (!client) return res.status(404).json({ error: 'Client not found' })
    res.json(client)
  } catch (err) { next(err) }
})

clientsRouter.post('/', async (req, res, next) => {
  try {
    const client = await prisma.client.create({
      data: req.body,
      include: { group: true },
    })
    res.status(201).json(client)
  } catch (err) { next(err) }
})

clientsRouter.patch('/:id', async (req, res, next) => {
  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: req.body,
      include: { group: true },
    })
    res.json(client)
  } catch (err) { next(err) }
})

clientsRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.client.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})
