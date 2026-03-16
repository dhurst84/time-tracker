import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

export const projectsRouter = Router()
projectsRouter.use(authenticate)

projectsRouter.get('/', async (req, res, next) => {
  try {
    const { clientId, includeArchived } = req.query
    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (includeArchived !== 'true') where.isActive = true

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: true,
        tasks: { where: { isActive: true } },
        _count: { select: { timeEntries: true } },
      },
      orderBy: { name: 'asc' },
    })
    res.json(projects)
  } catch (err) { next(err) }
})

projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        client: { include: { group: true } },
        tasks: true,
        budgetResets: { orderBy: { resetDate: 'desc' }, take: 12 },
      },
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    // Calculate hours used in current period
    let periodStart: Date | undefined
    if (project.type === 'recurring' && project.budgetResets.length > 0) {
      periodStart = project.budgetResets[0].resetDate
    }

    const hoursUsed = await prisma.timeEntry.aggregate({
      where: {
        projectId: project.id,
        date: periodStart ? { gte: periodStart } : undefined,
      },
      _sum: { hours: true },
    })

    res.json({ ...project, hoursUsed: hoursUsed._sum.hours || 0 })
  } catch (err) { next(err) }
})

projectsRouter.post('/', async (req, res, next) => {
  try {
    const project = await prisma.project.create({
      data: req.body,
      include: { client: true, tasks: true },
    })

    const defaultTemplates = await prisma.taskTemplate.findMany({
      where: { isDefault: true, isActive: true },
    })

    if (defaultTemplates.length > 0) {
      await prisma.task.createMany({
        data: defaultTemplates.map(t => ({
          name: t.name,
          projectId: project.id,
          isBillable: t.isBillable,
        })),
      })
      const projectWithTasks = await prisma.project.findUnique({
        where: { id: project.id },
        include: { client: true, tasks: true },
      })
      return res.status(201).json(projectWithTasks)
    }

    res.status(201).json(project)
  } catch (err) { next(err) }
})

projectsRouter.patch('/:id', async (req, res, next) => {
  try {
    const { name, type, recurringPeriod, budgetHours, notes, color, isActive } = req.body
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (type !== undefined) data.type = type
    if (recurringPeriod !== undefined) data.recurringPeriod = recurringPeriod
    if (budgetHours !== undefined) data.budgetHours = budgetHours === null ? null : parseFloat(budgetHours)
    if (notes !== undefined) data.notes = notes
    if (color !== undefined) data.color = color
    if (isActive !== undefined) data.isActive = isActive

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data,
      include: { client: true, tasks: true },
    })
    res.json(project)
  } catch (err) { next(err) }
})

projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})
