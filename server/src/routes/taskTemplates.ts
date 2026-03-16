import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate, requireAdmin } from '../middleware/auth'

export const taskTemplatesRouter = Router()
taskTemplatesRouter.use(authenticate)

taskTemplatesRouter.get('/', async (req, res, next) => {
  try {
    const templates = await prisma.taskTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
    res.json(templates)
  } catch (err) { next(err) }
})

taskTemplatesRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, isBillable, isDefault } = req.body
    const template = await prisma.taskTemplate.create({
      data: { name, isBillable: isBillable ?? true, isDefault: isDefault ?? false },
    })
    res.status(201).json(template)
  } catch (err) { next(err) }
})

taskTemplatesRouter.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, isBillable, isDefault } = req.body
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (isBillable !== undefined) data.isBillable = isBillable
    if (isDefault !== undefined) data.isDefault = isDefault
    const template = await prisma.taskTemplate.update({
      where: { id: req.params.id },
      data,
    })
    res.json(template)
  } catch (err) { next(err) }
})

taskTemplatesRouter.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.taskTemplate.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    res.status(204).send()
  } catch (err) { next(err) }
})
