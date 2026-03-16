import { prisma } from './prisma'

function getPeriodBounds(period: string, now: Date): { periodStart: Date; resetDate: Date } | null {
  const y = now.getFullYear()
  const m = now.getMonth() // 0-based

  if (period === 'monthly') {
    const periodStart = new Date(y, m, 1)
    return { periodStart, resetDate: periodStart }
  }
  if (period === 'quarterly') {
    const quarterStartMonth = Math.floor(m / 3) * 3
    const periodStart = new Date(y, quarterStartMonth, 1)
    return { periodStart, resetDate: periodStart }
  }
  if (period === 'biannually') {
    const halfStartMonth = m < 6 ? 0 : 6
    const periodStart = new Date(y, halfStartMonth, 1)
    return { periodStart, resetDate: periodStart }
  }
  if (period === 'annually') {
    const periodStart = new Date(y, 0, 1)
    return { periodStart, resetDate: periodStart }
  }
  return null
}

export async function checkBudgetResets() {
  const now = new Date()

  const recurringProjects = await prisma.project.findMany({
    where: { type: 'recurring', isActive: true, budgetHours: { not: null } },
  })

  for (const project of recurringProjects) {
    const period = (project as Record<string, unknown>).recurringPeriod as string || 'monthly'
    const bounds = getPeriodBounds(period, now)
    if (!bounds) continue

    const { periodStart, resetDate } = bounds

    // Only reset if today is on or past the reset date
    if (now < resetDate) continue

    // Check if we already reset in this period
    const existingReset = await prisma.budgetReset.findFirst({
      where: { projectId: project.id, resetDate: { gte: periodStart } },
    })
    if (existingReset) continue

    // Calculate hours used since last reset
    const lastReset = await prisma.budgetReset.findFirst({
      where: { projectId: project.id },
      orderBy: { resetDate: 'desc' },
    })

    const hoursQuery = await prisma.timeEntry.aggregate({
      where: {
        projectId: project.id,
        date: lastReset ? { gte: lastReset.resetDate } : undefined,
      },
      _sum: { hours: true },
    })

    await prisma.budgetReset.create({
      data: {
        projectId: project.id,
        resetDate,
        previousHoursUsed: hoursQuery._sum.hours || 0,
      },
    })
  }
}
