import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { formatHours, toInputDate, avatarInitials } from '../lib/utils'

interface User {
  id: string
  name: string
  avatarColor: string
  role: string
}

interface TimeEntry {
  id: string
  date: string
  hours: number
  notes?: string
  isRunning: boolean
  user: { id: string; name: string; avatarColor: string }
  project: { id: string; name: string; color: string; client: { name: string } }
  task: { id: string; name: string; isBillable: boolean }
}

type Preset = 'today' | 'week' | 'month' | 'custom'

function getPresetDates(preset: Preset): { start: string; end: string } {
  const now = new Date()
  if (preset === 'today') return { start: toInputDate(now), end: toInputDate(now) }
  if (preset === 'week') return {
    start: toInputDate(startOfWeek(now, { weekStartsOn: 1 })),
    end: toInputDate(endOfWeek(now, { weekStartsOn: 1 })),
  }
  if (preset === 'month') return {
    start: toInputDate(startOfMonth(now)),
    end: toInputDate(endOfMonth(now)),
  }
  return { start: toInputDate(now), end: toInputDate(now) }
}

export default function TeamPage() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()

  if (user?.role !== 'admin') {
    navigate('/today', { replace: true })
    return null
  }

  const [preset, setPreset] = useState<Preset>('today')
  const [customStart, setCustomStart] = useState(toInputDate(new Date()))
  const [customEnd, setCustomEnd] = useState(toInputDate(new Date()))
  const [filterUserId, setFilterUserId] = useState('')

  const dates = preset === 'custom'
    ? { start: customStart, end: customEnd }
    : getPresetDates(preset)

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['team-entries', dates.start, dates.end, filterUserId],
    queryFn: () =>
      api.get('/time-entries', {
        params: {
          startDate: dates.start,
          endDate: dates.end,
          ...(filterUserId ? { userId: filterUserId } : {}),
        },
      }).then(r => r.data),
  })

  // Group entries by user
  const byUser: Record<string, TimeEntry[]> = {}
  for (const e of entries) {
    if (!byUser[e.user.id]) byUser[e.user.id] = []
    byUser[e.user.id].push(e)
  }

  const totalHours = entries.filter(e => !e.isRunning).reduce((s, e) => s + e.hours, 0)

  const presetLabels: { value: Preset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'custom', label: 'Custom' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Team</h1>
          <p className="text-sm text-stone-500">View time logs across your team</p>
        </div>
        {totalHours > 0 && (
          <span className="text-2xl font-mono font-medium text-stone-900">{formatHours(totalHours)}</span>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {presetLabels.map(p => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input flex-1" />
            <span className="text-stone-400 text-sm">to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input flex-1" />
          </div>
        )}
        <div>
          <select
            value={filterUserId}
            onChange={e => setFilterUserId(e.target.value)}
            className="input"
          >
            <option value="">All team members</option>
            {users.filter(u => u.id !== user?.id).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
            <option value={user?.id ?? ''}>Me ({user?.name})</option>
          </select>
        </div>
      </div>

      {/* Entries */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" /></svg>
          <p className="font-medium">No time entries for this period</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byUser).map(([userId, userEntries]) => {
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
                          {format(parseISO(entry.date), 'MMM d')} · {entry.task.name}
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
                        {!entry.task.isBillable && (
                          <p className="text-xs text-stone-400">Non-billable</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
