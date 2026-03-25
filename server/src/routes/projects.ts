import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

export const projectsRouter = Router()
projectsRouter.use(authenticate)

projectsRouter.get('/', async (req, res, next) => {
  try {
    const { clientId, includeArchived, search, type } = req.query
    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (includeArchived !== 'true') where.isActive = true
    if (type) where.type = type
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { client: { name: { contains: search as string, mode: 'insensitive' } } },
      ]
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: true,
        tasks: { where: { isActive: true } },
        _count: { select: { timeEntries: true } },
      },
      orderBy: { name: 'asc' },
    })

    // Aggregate total hours per project in one query
    const allProjectIds = projects.map(p => p.id)
    const totalHoursAgg = allProjectIds.length > 0
      ? await prisma.timeEntry.groupBy({
          by: ['projectId'],
          where: { projectId: { in: allProjectIds } },
          _sum: { hours: true },
        })
      : []
    const totalHoursMap = new Map(totalHoursAgg.map(h => [h.projectId, h._sum.hours || 0]))

    // Get latest budget reset date per recurring project in one query
    const recurringProjectIds = projects.filter(p => p.type === 'recurring').map(p => p.id)
    const resetMap = new Map<string, Date>()
    if (recurringProjectIds.length > 0) {
      const latestResets = await prisma.budgetReset.findMany({
        where: { projectId: { in: recurringProjectIds } },
        orderBy: { resetDate: 'desc' },
      })
      for (const reset of latestResets) {
        if (!resetMap.has(reset.projectId)) {
          resetMap.set(reset.projectId, reset.resetDate)
        }
      }
    }

    // For recurring projects with resets, get hours since the reset date
    const sinceResetHoursMap = new Map<string, number>()
    for (const project of projects.filter(p => resetMap.has(p.id))) {
      const resetDate = resetMap.get(project.id)!
      const agg = await prisma.timeEntry.aggregate({
        where: { projectId: project.id, date: { gte: resetDate } },
        _sum: { hours: true },
      })
      sinceResetHoursMap.set(project.id, agg._sum.hours || 0)
    }

    const result = projects.map(p => ({
      ...p,
      hoursUsed: p.type === 'recurring' && resetMap.has(p.id)
        ? sinceResetHoursMap.get(p.id) || 0
        : totalHoursMap.get(p.id) || 0,
    }))

    res.json(result)
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
