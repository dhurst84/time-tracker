import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../lib/api'
import BudgetBar from '../components/BudgetBar'
import { formatHours, getBudgetStatus, toInputDate } from '../lib/utils'

interface Task { id: string; name: string; isBillable: boolean; isActive: boolean }
interface TaskTemplate { id: string; name: string; isBillable: boolean }
interface Project {
  id: string; name: string; color: string; type: string; recurringPeriod: string
  budgetHours?: number; notes?: string; isActive: boolean; hoursUsed: number
  client: { id: string; name: string }
  tasks: Task[]
}
interface TimeEntry {
  id: string; date: string; hours: number; notes?: string
  task: { id: string; name: string }
  user: { id: string; name: string; avatarColor: string }
}

const COLORS = ['#0d9488','#7c3aed','#db2777','#ea580c','#16a34a','#0ea5e9','#ca8a04','#dc2626']

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  biannually: 'Bi-Annually',
  annually: 'Annually',
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  // Add task
  const [showAddTask, setShowAddTask] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [newTaskBillable, setNewTaskBillable] = useState(true)

  // Edit project
  const [showEdit, setShowEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('one_time')
  const [editPeriod, setEditPeriod] = useState('monthly')
  const [editBudget, setEditBudget] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editColor, setEditColor] = useState(COLORS[0])

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`).then(r => r.data),
  })

  const { data: templates = [] } = useQuery<TaskTemplate[]>({
    queryKey: ['task-templates'],
    queryFn: () => api.get('/task-templates').then(r => r.data),
  })

  const { data: entries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['project-entries', id],
    queryFn: () => api.get('/time-entries', {
      params: { projectId: id, startDate: '2020-01-01', endDate: toInputDate(new Date()) }
    }).then(r => r.data),
    enabled: !!id,
  })

  const addTask = useMutation({
    mutationFn: (data: { name: string; projectId: string; isBillable: boolean }) =>
      api.post('/tasks', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      setShowAddTask(false)
      setSelectedTemplateId('')
      setNewTaskBillable(true)
      toast.success('Task added')
    },
    onError: () => toast.error('Failed to add task'),
  })

  const updateProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/projects/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowEdit(false)
      toast.success('Project updated')
    },
    onError: () => toast.error('Failed to update project'),
  })

  const archiveProject = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/projects/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); toast.success('Project updated') },
    onError: () => toast.error('Failed to update'),
  })

  function openEdit() {
    if (!project) return
    setEditName(project.name)
    setEditType(project.type)
    setEditPeriod(project.recurringPeriod || 'monthly')
    setEditBudget(project.budgetHours?.toString() || '')
    setEditNotes(project.notes || '')
    setEditColor(project.color)
    setShowEdit(true)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateProject.mutate({
      name: editName,
      type: editType,
      recurringPeriod: editType === 'recurring' ? editPeriod : undefined,
      budgetHours: editBudget ? parseFloat(editBudget) : null,
      notes: editNotes,
      color: editColor,
    })
  }

  const chartMonths = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of entries) {
      const key = toInputDate(e.date).slice(0, 7)
      map[key] = (map[key] || 0) + e.hours
    }
    const year = new Date().getFullYear()
    return Array.from({ length: 12 }, (_, i) => {
      const month = `${year}-${String(i + 1).padStart(2, '0')}`
      return [month, map[month] || 0] as [string, number]
    })
  }, [entries])
  const maxMonthHours = Math.max(1, ...chartMonths.map(([, h]) => h))

  if (isLoading) return <div className="max-w-3xl mx-auto px-4 py-6"><div className="skeleton h-8 w-64 mb-6" /></div>
  if (!project) return <div className="p-8 text-stone-400">Project not found</div>

  const budgetStatus = getBudgetStatus(project.hoursUsed, project.budgetHours || null)

  const groupedEntries: Record<string, TimeEntry[]> = {}
  for (const e of entries) {
    const key = toInputDate(e.date)
    if (!groupedEntries[key]) groupedEntries[key] = []
    groupedEntries[key].push(e)
  }
  const sortedDates = Object.entries(groupedEntries).sort(([a], [b]) => b.localeCompare(a)).slice(0, 10)

  const periodLabel = PERIOD_LABELS[project.recurringPeriod] || project.recurringPeriod

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link to={`/clients/${project.client.id}`} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        {project.client.name}
      </Link>

      {/* Header */}
      <div className="card p-5 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="w-4 h-4 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: project.color }} />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-semibold text-stone-900">{project.name}</h1>
              <div className="flex items-center gap-2">
                {budgetStatus === 'over' && <span className="badge-red">Over budget</span>}
                {budgetStatus === 'warning' && <span className="badge-yellow">80%+ used</span>}
                <button onClick={openEdit} className="btn-ghost text-xs">Edit</button>
                <button
                  onClick={() => archiveProject.mutate(!project.isActive)}
                  className="btn-ghost text-xs"
                >
                  {project.isActive ? 'Archive' : 'Restore'}
                </button>
              </div>
            </div>
            <p className="text-sm text-stone-500 mt-0.5">
              {project.type === 'one_time' ? 'One-time' : `Recurring · ${periodLabel}`}
            </p>
            {project.notes && <p className="text-sm text-stone-500 mt-1">{project.notes}</p>}
          </div>
        </div>

        {project.budgetHours ? (
          <BudgetBar used={project.hoursUsed} budget={project.budgetHours} />
        ) : (
          <p className="text-sm text-stone-500">
            <span className="font-mono font-medium">{formatHours(project.hoursUsed)}</span> logged · no budget set
          </p>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">Edit Project</h2>
            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="label">Project name *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select value={editType} onChange={e => setEditType(e.target.value)} className="input">
                    <option value="one_time">One-time</option>
                    <option value="recurring">Recurring</option>
                  </select>
                </div>
                {editType === 'recurring' && (
                  <div>
                    <label className="label">Period</label>
                    <select value={editPeriod} onChange={e => setEditPeriod(e.target.value)} className="input">
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="biannually">Bi-Annually</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Budget (hours)</label>
                <input
                  type="number"
                  step="1"
                  value={editBudget}
                  onChange={e => setEditBudget(e.target.value)}
                  className="input"
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Color</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${editColor === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={updateProject.isPending} className="btn-primary flex-1 justify-center">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tasks */}
      <div className="card mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-stone-900">Tasks</h2>
          <button onClick={() => setShowAddTask(true)} className="btn-ghost text-xs">+ Add task</button>
        </div>
        {showAddTask && (() => {
          const existingNames = new Set(project.tasks.map(t => t.name.toLowerCase()))
          const available = templates.filter(t => !existingNames.has(t.name.toLowerCase()))
          const selectedTemplate = available.find(t => t.id === selectedTemplateId)
          return (
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
              {available.length === 0 ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-stone-500">All task templates have already been added to this project.</p>
                  <button type="button" onClick={() => setShowAddTask(false)} className="btn-ghost">Cancel</button>
                </div>
              ) : (
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    if (!selectedTemplate) return toast.error('Select a task')
                    addTask.mutate({ name: selectedTemplate.name, projectId: id!, isBillable: newTaskBillable })
                  }}
                  className="flex items-center gap-3"
                >
                  <select
                    value={selectedTemplateId}
                    onChange={e => {
                      const tmpl = available.find(t => t.id === e.target.value)
                      setSelectedTemplateId(e.target.value)
                      if (tmpl) setNewTaskBillable(tmpl.isBillable)
                    }}
                    className="input flex-1"
                    required
                  >
                    <option value="">Select a task…</option>
                    {available.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-stone-600 flex-shrink-0">
                    <input type="checkbox" checked={newTaskBillable} onChange={e => setNewTaskBillable(e.target.checked)} />
                    Billable
                  </label>
                  <button type="submit" disabled={addTask.isPending} className="btn-primary">Add</button>
                  <button type="button" onClick={() => { setShowAddTask(false); setSelectedTemplateId('') }} className="btn-ghost">Cancel</button>
                </form>
              )}
            </div>
          )
        })()}
        {project.tasks.length === 0 ? (
          <p className="px-4 py-4 text-sm text-stone-400">No tasks yet</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {project.tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-sm text-stone-900 flex-1">{task.name}</span>
                {task.isBillable ? <span className="badge-green">Billable</span> : <span className="text-xs text-stone-400">Non-billable</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Monthly breakdown */}
      <div className="card mb-6">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-stone-900">Monthly Breakdown</h2>
        </div>
        {chartMonths.length === 0 ? (
          <p className="px-4 py-4 text-sm text-stone-400">No entries yet</p>
        ) : (
          <div className="px-4 pt-6 pb-4">
            {/* Bars */}
            <div className="flex items-end gap-1.5" style={{ height: '120px' }}>
              {chartMonths.map(([month, hours]) => {
                const barPct = Math.max(3, (hours / maxMonthHours) * 100)
                return (
                  <div key={month} className="flex-1 flex flex-col justify-end items-center min-w-0 h-full relative">
                    {barPct > 15 && (
                      <span className="text-xs text-stone-500 font-mono mb-1 truncate w-full text-center">
                        {formatHours(hours)}
                      </span>
                    )}
                    <div
                      className="w-full bg-teal-500 rounded-t-sm"
                      style={{ height: `${barPct}%` }}
                    />
                  </div>
                )
              })}
            </div>
            {/* Month labels */}
            <div className="flex gap-1.5 mt-2 border-t border-stone-100 pt-2">
              {chartMonths.map(([month]) => (
                <div key={month} className="flex-1 text-center min-w-0">
                  <span className="text-xs text-stone-400">{format(parseISO(month + '-01'), 'MMM')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent time entries */}
      <div className="card">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-semibold text-stone-900">Recent Time Entries</h2>
        </div>
        {entries.length === 0 ? (
          <p className="px-4 py-4 text-sm text-stone-400">No entries yet</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {sortedDates.map(([dateKey, dayEntries]) => (
              <div key={dateKey}>
                <div className="px-4 py-2 bg-stone-50">
                  <span className="text-xs font-medium text-stone-500">{format(parseISO(dateKey), 'MMM d, yyyy')}</span>
                </div>
                {dayEntries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                      style={{ backgroundColor: entry.user.avatarColor }}
                    >
                      {entry.user.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-900">{entry.task.name}</p>
                      {entry.notes && <p className="text-xs text-stone-400 truncate">{entry.notes}</p>}
                    </div>
                    <span className="font-mono text-sm text-stone-600 flex-shrink-0">{formatHours(entry.hours)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
