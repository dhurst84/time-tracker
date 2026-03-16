import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

export const clientGroupsRouter = Router()
clientGroupsRouter.use(authenticate)

clientGroupsRouter.get('/', async (req, res, next) => {
  try {
    const groups = await prisma.clientGroup.findMany({
      include: { _count: { select: { clients: true } } },
      orderBy: { name: 'asc' },
    })
    res.json(groups)
  } catch (err) { next(err) }
})

clientGroupsRouter.get('/:id', async (req, res, next) => {
  try {
    const group = await prisma.clientGroup.findUnique({
      where: { id: req.params.id },
      include: { clients: { include: { projects: { where: { isActive: true } } } } },
    })
    if (!group) return res.status(404).json({ error: 'Group not found' })
    res.json(group)
  } catch (err) { next(err) }
})

clientGroupsRouter.post('/', async (req, res, next) => {
  try {
    const group = await prisma.clientGroup.create({ data: req.body })
    res.status(201).json(group)
  } catch (err) { next(err) }
})

clientGroupsRouter.patch('/:id', async (req, res, next) => {
  try {
    const group = await prisma.clientGroup.update({ where: { id: req.params.id }, data: req.body })
    res.json(group)
  } catch (err) { next(err) }
})

clientGroupsRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.clientGroup.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})
