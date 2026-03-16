import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { clientGroupsRouter } from './routes/clientGroups'
import { clientsRouter } from './routes/clients'
import { projectsRouter } from './routes/projects'
import { tasksRouter } from './routes/tasks'
import { taskTemplatesRouter } from './routes/taskTemplates'
import { timeEntriesRouter } from './routes/timeEntries'
import { reportsRouter } from './routes/reports'
import { errorHandler } from './middleware/errorHandler'
import { checkBudgetResets } from './lib/budgetReset'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/users', usersRouter)
app.use('/api/v1/client-groups', clientGroupsRouter)
app.use('/api/v1/clients', clientsRouter)
app.use('/api/v1/projects', projectsRouter)
app.use('/api/v1/tasks', tasksRouter)
app.use('/api/v1/task-templates', taskTemplatesRouter)
app.use('/api/v1/time-entries', timeEntriesRouter)
app.use('/api/v1/reports', reportsRouter)
app.use(errorHandler)

// Check budget resets on startup and daily at midnight
checkBudgetResets()
cron.schedule('0 0 * * *', checkBudgetResets)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
