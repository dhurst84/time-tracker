import { Router, Request } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

export const reportsRouter = Router()
reportsRouter.use(authenticate)

function getDateRange(req: Request) {
  const { startDate, endDate, preset } = req.query
  const now = new Date()

  if (preset === 'this_week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    return { start, end: now }
  }
  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start, end: now }
  }
  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start, end }
  }

  return {
    start: startDate ? new Date(startDate as string) : new Date(now.getFullYear(), now.getMonth(), 1),
    end: endDate ? new Date(endDate as string) : now,
  }
}

reportsRouter.get('/by-client', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req)
    const { clientId } = req.query
    const entries = await prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, ...(clientId ? { project: { clientId: clientId as string } } : {}) },
      include: {
        project: { include: { client: { include: { group: true } } } },
        task: true,
        user: { select: { id: true, name: true } },
      },
    })

    const byClient: Record<string, { clientId: string; clientName: string; color: string; totalHours: number; projects: Record<string, { projectId: string; projectName: string; hours: number }> }> = {}

    for (const entry of entries) {
      const client = entry.project.client
      if (!byClient[client.id]) {
        byClient[client.id] = { clientId: client.id, clientName: client.name, color: client.color, totalHours: 0, projects: {} }
      }
      byClient[client.id].totalHours += entry.hours
      if (!byClient[client.id].projects[entry.project.id]) {
        byClient[client.id].projects[entry.project.id] = { projectId: entry.project.id, projectName: entry.project.name, hours: 0 }
      }
      byClient[client.id].projects[entry.project.id].hours += entry.hours
    }

    const result = Object.values(byClient).map(c => ({
      ...c,
      totalHours: Math.round(c.totalHours * 100) / 100,
      projects: Object.values(c.projects).map(p => ({ ...p, hours: Math.round(p.hours * 100) / 100 })),
    }))

    res.json({ data: result, dateRange: { start, end } })
  } catch (err) { next(err) }
})

reportsRouter.get('/by-group', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req)
    const { clientId } = req.query
    const entries = await prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, ...(clientId ? { project: { clientId: clientId as string } } : {}) },
      include: { project: { include: { client: { include: { group: true } } } } },
    })

    const byGroup: Record<string, { groupId: string | null; groupName: string; totalHours: number; clients: Record<string, { clientId: string; clientName: string; hours: number }> }> = {}

    for (const entry of entries) {
      const client = entry.project.client
      const groupId = client.groupId || 'ungrouped'
      const groupName = client.group?.name || 'Ungrouped'

      if (!byGroup[groupId]) {
        byGroup[groupId] = { groupId: client.groupId, groupName, totalHours: 0, clients: {} }
      }
      byGroup[groupId].totalHours += entry.hours
      if (!byGroup[groupId].clients[client.id]) {
        byGroup[groupId].clients[client.id] = { clientId: client.id, clientName: client.name, hours: 0 }
      }
      byGroup[groupId].clients[client.id].hours += entry.hours
    }

    const result = Object.values(byGroup).map(g => ({
      ...g,
      totalHours: Math.round(g.totalHours * 100) / 100,
      clients: Object.values(g.clients).map(c => ({ ...c, hours: Math.round(c.hours * 100) / 100 })),
    }))

    res.json({ data: result, dateRange: { start, end } })
  } catch (err) { next(err) }
})

reportsRouter.get('/by-project', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req)
    const { clientId } = req.query
    const entries = await prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, ...(clientId ? { project: { clientId: clientId as string } } : {}) },
      include: { project: { include: { client: true, budgetResets: { orderBy: { resetDate: 'desc' }, take: 1 } } } },
    })

    const byProject: Record<string, { projectId: string; projectName: string; clientName: string; color: string; budgetHours: number | null; hoursUsed: number; type: string }> = {}

    for (const entry of entries) {
      const p = entry.project
      if (!byProject[p.id]) {
        byProject[p.id] = { projectId: p.id, projectName: p.name, clientName: p.client.name, color: p.color, budgetHours: p.budgetHours, hoursUsed: 0, type: p.type }
      }
      byProject[p.id].hoursUsed += entry.hours
    }

    const result = Object.values(byProject).map(p => ({
      ...p,
      hoursUsed: Math.round(p.hoursUsed * 100) / 100,
      budgetPercent: p.budgetHours ? Math.round((p.hoursUsed / p.budgetHours) * 100) : null,
    }))

    res.json({ data: result, dateRange: { start, end } })
  } catch (err) { next(err) }
})

reportsRouter.get('/by-task', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req)
    const { clientId } = req.query
    const entries = await prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, ...(clientId ? { project: { clientId: clientId as string } } : {}) },
      include: { task: true, project: { include: { client: true } } },
    })

    const byTask: Record<string, { taskId: string; taskName: string; isBillable: boolean; totalHours: number; projectCount: Set<string> }> = {}

    for (const entry of entries) {
      const t = entry.task
      if (!byTask[t.name]) {
        byTask[t.name] = { taskId: t.id, taskName: t.name, isBillable: t.isBillable, totalHours: 0, projectCount: new Set() }
      }
      byTask[t.name].totalHours += entry.hours
      byTask[t.name].projectCount.add(entry.projectId)
    }

    const result = Object.values(byTask).map(t => ({
      taskId: t.taskId,
      taskName: t.taskName,
      isBillable: t.isBillable,
      totalHours: Math.round(t.totalHours * 100) / 100,
      projectCount: t.projectCount.size,
    }))

    res.json({ data: result, dateRange: { start, end } })
  } catch (err) { next(err) }
})

reportsRouter.get('/by-member', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req)
    const { clientId } = req.query
    const entries = await prisma.timeEntry.findMany({
      where: { date: { gte: start, lte: end }, ...(clientId ? { project: { clientId: clientId as string } } : {}) },
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        project: { include: { client: true } },
        task: true,
      },
    })

    const byUser: Record<string, { userId: string; userName: string; avatarColor: string; totalHours: number; projects: Record<string, { projectId: string; projectName: string; clientName: string; hours: number }> }> = {}

    for (const entry of entries) {
      const u = entry.user
      if (!byUser[u.id]) {
        byUser[u.id] = { userId: u.id, userName: u.name, avatarColor: u.avatarColor, totalHours: 0, projects: {} }
      }
      byUser[u.id].totalHours += entry.hours
      const key = entry.projectId
      if (!byUser[u.id].projects[key]) {
        byUser[u.id].projects[key] = { projectId: entry.project.id, projectName: entry.project.name, clientName: entry.project.client.name, hours: 0 }
      }
      byUser[u.id].projects[key].hours += entry.hours
    }

    const result = Object.values(byUser).map(u => ({
      ...u,
      totalHours: Math.round(u.totalHours * 100) / 100,
      projects: Object.values(u.projects).map(p => ({ ...p, hours: Math.round(p.hours * 100) / 100 })),
    }))

    res.json({ data: result, dateRange: { start, end } })
  } catch (err) { next(err) }
})

reportsRouter.get('/detail-log', async (req, res, next) => {
  try {
    const { start, end } = getDateRange(req)
    const { userId, projectId, taskId, clientId, billable } = req.query

    const where: Record<string, unknown> = { date: { gte: start, lte: end } }
    if (userId) where.userId = userId
    if (projectId) where.projectId = projectId
    if (taskId) where.taskId = taskId
    if (clientId) {
      where.project = { clientId }
    }
    if (billable !== undefined) {
      where.task = { isBillable: billable === 'true' }
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

    res.json({ data: entries, dateRange: { start, end }, total: entries.reduce((sum, e) => sum + e.hours, 0) })
  } catch (err) { next(err) }
})
