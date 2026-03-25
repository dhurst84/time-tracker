import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { formatHours, toInputDate, avatarInitials } from '../lib/utils'

interface User {
  id: string
  name: string
  avatarColor: string
  role: string
  weeklyCapacity: number
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

interface UtilizationStat {
  userId: string
  name: string
  avatarColor: string
  weeklyCapacity: number
  hoursLogged: number
  billableHours: number
  nonBillableHours: number
  capacityHours: number
  utilizationPct: number
  billablePct: number
}

type Preset = 'today' | 'week' | 'month' | 'custom'
type RangePreset = 'week' | 'month' | 'lastMonth' | 'custom'

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

function utilizationColor(pct: number) {
  if (pct > 100) return 'text-red-600 bg-red-50'
  if (pct >= 85) return 'text-amber-600 bg-amber-50'
  return 'text-green-600 bg-green-50'
}

export default function TeamPage() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()

  if (user?.role !== 'admin') {
    navigate('/today', { replace: true })
    return null
  }

  // --- Time entries section state ---
  const [preset, setPreset] = useState<Preset>('today')
  const [customStart, setCustomStart] = useState(toInputDate(new Date()))
  const [customEnd, setCustomEnd] = useState(toInputDate(new Date()))
  const [filterUserId, setFilterUserId] = useState('')

  const dates = preset === 'custom'
    ? { start: customStart, end: customEnd }
    : getPresetDates(preset)

  // --- Utilization section state ---
  const [rangePreset, setRangePreset] = useState<RangePreset>('month')
  const [utilCustomStart, setUtilCustomStart] = useState('')
  const [utilCustomEnd, setUtilCustomEnd] = useState('')

  const { startDate, endDate } = useMemo(() => {
    const today = new Date()
    if (rangePreset === 'week') return {
      startDate: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      endDate: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }
    if (rangePreset === 'lastMonth') {
      const last = subMonths(today, 1)
      return {
        startDate: format(startOfMonth(last), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(last), 'yyyy-MM-dd'),
      }
    }
    if (rangePreset === 'custom') return { startDate: utilCustomStart, endDate: utilCustomEnd }
    // default: month
    return {
      startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(today), 'yyyy-MM-dd'),
    }
  }, [rangePreset, utilCustomStart, utilCustomEnd])

  // --- Edit capacity state ---
  const [editingCapacityId, setEditingCapacityId] = useState<string | null>(null)
  const [capacityInput, setCapacityInput] = useState('')

  // --- Queries ---
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

  const { data: utilStats = [], isLoading: utilLoading } = useQuery<UtilizationStat[]>({
    queryKey: ['utilization', startDate, endDate],
    queryFn: () => api.get('/users/utilization', { params: { startDate, endDate } }).then(r => r.data),
    enabled: !!startDate && !!endDate,
  })

  // --- Mutations ---
  const updateCapacity = useMutation({
    mutationFn: ({ userId, weeklyCapacity }: { userId: string; weeklyCapacity: number }) =>
      api.patch(`/users/${userId}`, { weeklyCapacity }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utilization'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditingCapacityId(null)
      toast.success('Capacity updated')
    },
    onError: () => toast.error('Failed to update capacity'),
  })

  // --- Derived data ---
  const byUser: Record<string, TimeEntry[]> = {}
  for (const e of entries) {
    if (!byUser[e.user.id]) byUser[e.user.id] = []
    byUser[e.user.id].push(e)
  }

  const totalHours = entries.filter(e => !e.isRunning).reduce((s, e) => s + e.hours, 0)

  const summary = useMemo(() => {
    const totalLogged = utilStats.reduce((s, u) => s + u.hoursLogged, 0)
    const totalCapacity = utilStats.reduce((s, u) => s + u.capacityHours, 0)
    const totalBillable = utilStats.reduce((s, u) => s + u.billableHours, 0)
    return {
      totalHours: totalLogged,
      totalCapacity,
      utilizationPct: totalCapacity > 0 ? (totalLogged / totalCapacity) * 100 : 0,
      billablePct: totalLogged > 0 ? (totalBillable / totalLogged) * 100 : 0,
    }
  }, [utilStats])

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
          <p className="text-sm text-stone-500">Capacity, utilization, and time logs across your team</p>
        </div>
      </div>

      {/* ── Capacity & Utilization Section ── */}
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Capacity &amp; Utilization</h2>

      {/* Utilization date range filter */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(['week', 'month', 'lastMonth', 'custom'] as RangePreset[]).map(p => (
          <button
            key={p}
            onClick={() => setRangePreset(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${rangePreset === p ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300'}`}
          >
            {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p === 'lastMonth' ? 'Last Month' : 'Custom'}
          </button>
        ))}
        {rangePreset === 'custom' && (
          <>
            <input type="date" value={utilCustomStart} onChange={e => setUtilCustomStart(e.target.value)} className="input w-auto" />
            <span className="text-stone-400 text-sm">to</span>
            <input type="date" value={utilCustomEnd} onChange={e => setUtilCustomEnd(e.target.value)} className="input w-auto" />
          </>
        )}
      </div>

      {/* Company-wide summary card */}
      {utilStats.length > 0 && (
        <div className="card p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Hours Logged', value: formatHours(summary.totalHours) },
            { label: 'Total Capacity', value: formatHours(summary.totalCapacity) },
            { label: 'Utilization', value: `${Math.round(summary.utilizationPct)}%` },
            { label: 'Billable', value: `${Math.round(summary.billablePct)}%` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="font-mono text-xl font-semibold text-stone-900">{value}</p>
              <p className="text-xs text-stone-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-member utilization rows */}
      {utilLoading ? (
        <div className="space-y-3 mb-8">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : utilStats.length === 0 ? (
        <div className="card p-6 mb-8 text-center text-stone-400">
          <p className="text-sm">No team members found.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {utilStats.map(stat => {
            const billablePct = Math.min(100, (stat.billableHours / (stat.capacityHours || 1)) * 100)
            const nonBillablePct = Math.min(100 - billablePct, (stat.nonBillableHours / (stat.capacityHours || 1)) * 100)
            const utilColor = utilizationColor(stat.utilizationPct)
            return (
              <div key={stat.userId} className="card p-4">
                {/* Member header */}
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: stat.avatarColor }}
                  >
                    {avatarInitials(stat.name)}
                  </div>
                  <span className="text-sm font-medium text-stone-700">{stat.name}</span>
                </div>
                {/* Bar */}
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500 rounded-l-full" style={{ width: `${billablePct}%` }} />
                  <div className="h-full bg-blue-200" style={{ width: `${nonBillablePct}%` }} />
                </div>
                {/* Stats row */}
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-stone-600">{formatHours(stat.hoursLogged)} / {formatHours(stat.capacityHours)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium font-mono ${utilColor}`}>
                      {Math.round(stat.utilizationPct)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400 font-mono">{Math.round(stat.billablePct)}% billable</span>
                    {/* Edit capacity */}
                    {editingCapacityId === stat.userId ? (
                      <form
                        onSubmit={e => {
                          e.preventDefault()
                          updateCapacity.mutate({ userId: stat.userId, weeklyCapacity: parseFloat(capacityInput) })
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          type="number"
                          value={capacityInput}
                          onChange={e => setCapacityInput(e.target.value)}
                          className="input w-16 text-xs py-0.5"
                          step="1"
                          min="1"
                          autoFocus
                        />
                        <span className="text-xs text-stone-400">h/wk</span>
                        <button type="submit" className="text-xs text-blue-600 hover:text-blue-800">Save</button>
                        <button type="button" onClick={() => setEditingCapacityId(null)} className="text-xs text-stone-400 hover:text-stone-600">✕</button>
                      </form>
                    ) : (
                      <button
                        onClick={() => { setEditingCapacityId(stat.userId); setCapacityInput(stat.weeklyCapacity.toString()) }}
                        className="text-xs text-stone-400 hover:text-stone-600"
                      >
                        {stat.weeklyCapacity}h/wk
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Time Entries Section ── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Time Entries</h2>
        {totalHours > 0 && (
          <span className="text-lg font-mono font-medium text-stone-900">{formatHours(totalHours)}</span>
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
