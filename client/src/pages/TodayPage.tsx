import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, isToday as dateFnsIsToday, parseISO, startOfWeek, addDays, addWeeks } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useTimerStore } from '../store/timerStore'
import { formatHours, formatTimer, toInputDate, avatarInitials, parseTimeInput } from '../lib/utils'
import ProjectSelect from '../components/ProjectSelect'
import TaskSelect from '../components/TaskSelect'

interface Task { id: string; name: string; isBillable: boolean }
interface Project { id: string; name: string; color: string; tasks: Task[]; client: { id: string; name: string } }
interface User { id: string; name: string; avatarColor: string }
interface TimeEntry {
  id: string
  date: string
  hours: number
  notes?: string
  isRunning: boolean
  startedAt?: string
  project: { id: string; name: string; color: string; client: { id: string; name: string } }
  task: { id: string; name: string; isBillable: boolean }
  user: { id: string; name: string; avatarColor: string }
}

function formatNavHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export default function TodayPage() {
  const user = useAuthStore(s => s.user)
  const { runningEntry, elapsedSeconds, setRunningEntry } = useTimerStore()
  const qc = useQueryClient()

  // Shared timer/log form state
  const [timerProject, setTimerProject] = useState('')
  const [timerTask, setTimerTask] = useState('')
  const [timerNotes, setTimerNotes] = useState('')
  const [logHours, setLogHours] = useState('')
  const [logDate, setLogDate] = useState(toInputDate(new Date()))
  const [timerProjectData, setTimerProjectData] = useState<Project | null>(null)

  // Timer widget "also track for"
  const [timerAdditionalUserIds, setTimerAdditionalUserIds] = useState<string[]>([])

  // Manual entry form
  const [showManual, setShowManual] = useState(false)
  const [manualDate, setManualDate] = useState(toInputDate(new Date()))
  const [manualProject, setManualProject] = useState('')
  const [manualTask, setManualTask] = useState('')
  const [manualHours, setManualHours] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const [manualProjectData, setManualProjectData] = useState<Project | null>(null)
  const [additionalUserIds, setAdditionalUserIds] = useState<string[]>([])

  // Week nav
  const todayStr = toInputDate(new Date())
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [weekOffset, setWeekOffset] = useState(0)
  const weekDays = (() => {
    const monday = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset)
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  })()

  // Editing
  const [editId, setEditId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editHours, setEditHours] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Fetch entries for the visible week
  const weekStart = weekDays[0]
  const weekEnd = addDays(weekDays[6], 1)
  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['time-entries', weekOffset],
    queryFn: () =>
      api.get('/time-entries', {
        params: { startDate: toInputDate(weekStart), endDate: toInputDate(weekEnd), userId: user?.id },
      }).then(r => r.data),
  })

  // Fetch today's team entries (admin only)
  const today = toInputDate(new Date())
  const { data: teamEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['team-entries-today', today],
    queryFn: () => {
      const tomorrow = new Date()
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      return api.get('/time-entries', { params: { startDate: today, endDate: toInputDate(tomorrow) } }).then(r => r.data)
    },
    enabled: user?.role === 'admin',
  })

  // Fetch projects for task loading
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  // Fetch all users for "also track for" feature
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })
  const otherUsers = allUsers.filter(u => u.id !== user?.id)

  const startMutation = useMutation({
    mutationFn: (data: { projectId: string; taskId: string; notes: string; additionalUserIds?: string[] }) =>
      api.post('/time-entries/start', data).then(r => r.data),
    onSuccess: (data) => {
      setRunningEntry(data)
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      qc.invalidateQueries({ queryKey: ['team-entries-today'] })
      setTimerNotes('')
      setTimerAdditionalUserIds([])
      toast.success('Timer started')
    },
    onError: () => toast.error('Failed to start timer'),
  })

  const stopMutation = useMutation({
    mutationFn: (id: string) => api.post(`/time-entries/stop/${id}`).then(r => r.data),
    onSuccess: (stoppedEntry) => {
      setRunningEntry(null)
      qc.setQueryData<TimeEntry[]>(['time-entries'], (old = []) =>
        old.map(e => e.id === stoppedEntry.id ? stoppedEntry : e)
      )
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      qc.invalidateQueries({ queryKey: ['team-entries-today'] })
      toast.success('Timer stopped')
    },
    onError: () => toast.error('Failed to stop timer'),
  })

  const createMutation = useMutation({
    mutationFn: (data: { projectId: string; taskId: string; date: string; hours: number; notes: string; additionalUserIds?: string[] }) =>
      api.post('/time-entries', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      qc.invalidateQueries({ queryKey: ['team-entries-today'] })
      setShowManual(false)
      setManualProject('')
      setManualTask('')
      setManualHours('')
      setManualNotes('')
      setAdditionalUserIds([])
      toast.success('Time entry added')
    },
    onError: () => toast.error('Failed to add entry'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; date?: string; hours?: number; notes?: string }) =>
      api.patch(`/time-entries/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      setEditId(null)
      toast.success('Entry updated')
    },
    onError: () => toast.error('Failed to update'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/time-entries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] })
      qc.invalidateQueries({ queryKey: ['team-entries-today'] })
      toast.success('Entry deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  function handleStartTimer() {
    if (!timerProject || !timerTask) return toast.error('Select a project and task')
    startMutation.mutate({
      projectId: timerProject,
      taskId: timerTask,
      notes: timerNotes,
      additionalUserIds: timerAdditionalUserIds.length > 0 ? timerAdditionalUserIds : undefined,
    })
  }

  function handleLogTime() {
    if (!timerProject || !timerTask || !logHours) return toast.error('Select a project, task, and enter hours')
    const hours = parseTimeInput(logHours)
    if (isNaN(hours) || hours <= 0) return toast.error('Enter hours as decimal (1.5) or time (1:30)')
    createMutation.mutate({
      projectId: timerProject,
      taskId: timerTask,
      date: logDate,
      hours,
      notes: timerNotes,
      additionalUserIds: timerAdditionalUserIds.length > 0 ? timerAdditionalUserIds : undefined,
    })
    setLogHours('')
    setLogDate(toInputDate(new Date()))
    setTimerNotes('')
    setTimerProject('')
    setTimerTask('')
    setTimerProjectData(null)
    setTimerAdditionalUserIds([])
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualProject || !manualTask || !manualHours) return toast.error('Fill all required fields')
    const hours = parseTimeInput(manualHours)
    if (isNaN(hours) || hours <= 0) return toast.error('Enter hours as decimal (1.5) or time (1:30)')
    createMutation.mutate({
      projectId: manualProject,
      taskId: manualTask,
      date: manualDate,
      hours,
      notes: manualNotes,
      additionalUserIds: additionalUserIds.length > 0 ? additionalUserIds : undefined,
    })
  }

  function startEdit(entry: TimeEntry) {
    setEditId(entry.id)
    setEditDate(toInputDate(entry.date))
    setEditHours(entry.hours.toString())
    setEditNotes(entry.notes || '')
  }

  const todayTotal = entries
    .filter(e => dateFnsIsToday(parseISO(e.date)) && !e.isRunning)
    .reduce((sum, e) => sum + e.hours, 0)

  const selectedDayEntries = entries.filter(e => toInputDate(e.date) === selectedDate)
  const selectedDayTotal = selectedDayEntries.filter(e => !e.isRunning).reduce((sum, e) => sum + e.hours, 0)

  // Team entries grouped by user (excluding current user)
  const teamOtherEntries = teamEntries.filter(e => e.user.id !== user?.id)
  const teamByUser: Record<string, TimeEntry[]> = {}
  for (const e of teamOtherEntries) {
    if (!teamByUser[e.user.id]) teamByUser[e.user.id] = []
    teamByUser[e.user.id].push(e)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Today</h1>
          <p className="text-sm text-stone-500">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-mono font-medium text-stone-900">{formatHours(todayTotal)}</span>
          <button onClick={() => setShowManual(true)} className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add time
          </button>
        </div>
      </div>

      {/* Weekly Day Navigation */}
      <div className="card p-2 mb-6">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors flex-shrink-0"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="grid grid-cols-7 flex-1">
            {weekDays.map((day) => {
              const dayStr = toInputDate(day)
              const isCurrentToday = dayStr === todayStr
              const isSelected = dayStr === selectedDate
              const dayTotal = entries
                .filter(e => toInputDate(e.date) === dayStr && !e.isRunning)
                .reduce((sum, e) => sum + e.hours, 0)

              return (
                <button
                  key={dayStr}
                  onClick={() => setSelectedDate(dayStr)}
                  className={`flex flex-col items-center py-2 px-1 rounded-lg transition-colors ${
                    isSelected && !isCurrentToday
                      ? 'bg-stone-100'
                      : isSelected && isCurrentToday
                      ? 'bg-orange-50'
                      : 'hover:bg-stone-50'
                  }`}
                >
                  <span className={`text-xs mb-0.5 ${isCurrentToday ? 'font-bold text-stone-900' : 'font-medium text-stone-400'}`}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={`text-xs ${isCurrentToday ? 'font-bold text-stone-900' : 'text-stone-400'}`}>
                    {format(day, 'M/d')}
                  </span>
                  <span className={`text-xs font-mono ${isSelected ? 'text-stone-900 font-semibold' : 'text-stone-400'}`}>
                    {formatNavHours(dayTotal)}
                  </span>
                  {isCurrentToday && (
                    <div className="w-4 h-0.5 bg-orange-400 rounded-full mt-1" />
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors flex-shrink-0"
            aria-label="Next week"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Timer widget */}
      <div className="card p-4 mb-6">
        {runningEntry ? (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-900">{runningEntry.project.client.name} — {runningEntry.project.name}</p>
              <p className="text-xs text-stone-500">{runningEntry.task.name}</p>
            </div>
            <span className="font-mono text-2xl font-medium text-blue-600">{formatTimer(elapsedSeconds)}</span>
            <button
              onClick={() => stopMutation.mutate(runningEntry.id)}
              disabled={stopMutation.isPending}
              className="btn-danger"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              Stop
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Project</label>
                <ProjectSelect
                  value={timerProject}
                  onChange={(id) => {
                    setTimerProject(id)
                    setTimerProjectData(projects.find(p => p.id === id) || null)
                    setTimerTask('')
                  }}
                />
              </div>
              <div>
                <label className="label">Task</label>
                <TaskSelect
                  tasks={timerProjectData?.tasks || []}
                  value={timerTask}
                  onChange={setTimerTask}
                  disabled={!timerProject}
                />
              </div>
            </div>
            <input
              type="text"
              value={timerNotes}
              onChange={e => setTimerNotes(e.target.value)}
              placeholder="What are you working on? (optional)"
              className="input w-full"
            />
            {otherUsers.length > 0 && (
              <div>
                <label className="label">Also track for</label>
                <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-36 overflow-y-auto">
                  {otherUsers.map(u => (
                    <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={timerAdditionalUserIds.includes(u.id)}
                        onChange={e => {
                          setTimerAdditionalUserIds(prev =>
                            e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                          )
                        }}
                        className="rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                      />
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{ backgroundColor: u.avatarColor }}
                      >
                        {u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <span className="text-sm text-stone-700">{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleStartTimer}
                disabled={startMutation.isPending}
                className="btn-primary"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Start timer
              </button>
              <span className="text-stone-400 text-sm">or</span>
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <input
                  type="date"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  className="input w-36"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={logHours}
                  onChange={e => setLogHours(e.target.value)}
                  placeholder="1.5 or 1:30"
                  className="input w-36"
                />
                <button
                  type="button"
                  onClick={handleLogTime}
                  disabled={createMutation.isPending}
                  className="btn-secondary"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Log time
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual entry modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-stone-900">Add Time Entry</h2>
              <button onClick={() => { setShowManual(false); setAdditionalUserIds([]) }} className="text-stone-400 hover:text-stone-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="label">Date</label>
                <input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Project</label>
                <ProjectSelect
                  value={manualProject}
                  onChange={(id) => {
                    setManualProject(id)
                    setManualProjectData(projects.find(p => p.id === id) || null)
                    setManualTask('')
                  }}
                />
              </div>
              <div>
                <label className="label">Task</label>
                <TaskSelect
                  tasks={manualProjectData?.tasks || []}
                  value={manualTask}
                  onChange={setManualTask}
                  disabled={!manualProject}
                />
              </div>
              <div>
                <label className="label">Hours</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualHours}
                  onChange={e => setManualHours(e.target.value)}
                  placeholder="1.5 or 1:30"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <input type="text" value={manualNotes} onChange={e => setManualNotes(e.target.value)} className="input" />
              </div>
              {otherUsers.length > 0 && (
                <div>
                  <label className="label">Also track for</label>
                  <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-36 overflow-y-auto">
                    {otherUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-stone-50">
                        <input
                          type="checkbox"
                          checked={additionalUserIds.includes(u.id)}
                          onChange={e => {
                            setAdditionalUserIds(prev =>
                              e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                            )
                          }}
                          className="rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                        />
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: u.avatarColor }}
                        >
                          {u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span className="text-sm text-stone-700">{u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowManual(false); setAdditionalUserIds([]) }} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1 justify-center">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return to Today button */}
      {(selectedDate !== todayStr || weekOffset !== 0) && (
        <div className="mb-4">
          <button
            onClick={() => { setSelectedDate(todayStr); setWeekOffset(0) }}
            className="btn-secondary text-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Return to Today
          </button>
        </div>
      )}

      {/* My time entries for selected day */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4">
              <div className="skeleton h-4 w-32 mb-3" />
              <div className="space-y-2">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : selectedDayEntries.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" /></svg>
          <p className="font-medium">No time entries</p>
          <p className="text-sm mt-1">
            {selectedDate === todayStr ? 'Start a timer or add time manually' : format(parseISO(selectedDate), 'EEEE, MMM d')}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
            <span className="text-sm font-medium text-stone-700">
              {selectedDate === todayStr ? 'Today' : format(parseISO(selectedDate), 'EEEE, MMM d')}
            </span>
            <span className="font-mono text-sm font-medium text-stone-600">{formatHours(selectedDayTotal)}</span>
          </div>
          <div className="divide-y divide-stone-100">
            {selectedDayEntries.map(entry => (
              <div key={entry.id} className="px-4 py-3">
                {editId === entry.id ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="date"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      className="input w-36"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editHours}
                      onChange={e => setEditHours(e.target.value)}
                      placeholder="1.5 or 1:30"
                      className="input w-24"
                    />
                    <input
                      type="text"
                      value={editNotes}
                      onChange={e => setEditNotes(e.target.value)}
                      placeholder="Notes"
                      className="input flex-1"
                    />
                    <button
                      onClick={() => {
                        const hours = parseTimeInput(editHours)
                        if (isNaN(hours) || hours <= 0) return toast.error('Enter hours as decimal (1.5) or time (1:30)')
                        updateMutation.mutate({ id: entry.id, date: editDate, hours, notes: editNotes })
                      }}
                      className="btn-primary"
                    >Save</button>
                    <button onClick={() => setEditId(null)} className="btn-ghost">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.project.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">
                        {entry.project.client.name} — {entry.project.name}
                      </p>
                      <p className="text-xs text-stone-500 truncate">
                        {entry.task.name}
                        {entry.notes && <span className="ml-2 text-stone-400">{entry.notes}</span>}
                      </p>
                    </div>
                    <span className="font-mono text-sm font-medium text-stone-700 flex-shrink-0">
                      {entry.isRunning ? formatTimer(elapsedSeconds) : formatHours(entry.hours)}
                    </span>
                    {!entry.isRunning && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => startEdit(entry)} className="btn-ghost px-2 py-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => { if (confirm('Delete this entry?')) deleteMutation.mutate(entry.id) }}
                          className="btn-ghost px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team activity today (admin only) */}
      {user?.role === 'admin' && Object.keys(teamByUser).length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Team — Today</h2>
          <div className="space-y-4">
            {Object.entries(teamByUser).map(([userId, userEntries]) => {
              const u = userEntries[0].user
              const userTotal = userEntries.filter(e => !e.isRunning).reduce((s, e) => s + e.hours, 0)
              return (
                <div key={userId} className="card overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-stone-50 border-b border-stone-100">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ backgroundColor: u.avatarColor }}
                    >
                      {avatarInitials(u.name)}
                    </div>
                    <span className="text-sm font-medium text-stone-700 flex-1">{u.name}</span>
                    <span className="font-mono text-sm font-medium text-stone-600">{formatHours(userTotal)}</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {userEntries.map(entry => (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.project.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-900 truncate">
                            {entry.project.client.name} — {entry.project.name}
                          </p>
                          <p className="text-xs text-stone-500 truncate">
                            {entry.task.name}
                            {entry.notes && <span className="ml-2 text-stone-400">{entry.notes}</span>}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {entry.isRunning ? (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Running
                            </span>
                          ) : (
                            <span className="font-mono text-sm font-medium text-stone-700">{formatHours(entry.hours)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
