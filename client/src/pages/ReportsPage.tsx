import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import api from '../lib/api'
import { formatHours, toInputDate } from '../lib/utils'

type ReportTab = 'by-client' | 'by-group' | 'by-project' | 'by-task' | 'by-member' | 'detail-log'
type Preset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'ytd' | 'custom'

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'by-client', label: 'By Client' },
  { id: 'by-group', label: 'By Group' },
  { id: 'by-project', label: 'By Project' },
  { id: 'by-task', label: 'By Task' },
  { id: 'by-member', label: 'By Member' },
  { id: 'detail-log', label: 'Detail Log' },
]

const CHART_COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0ea5e9','#ca8a04','#dc2626','#6366f1','#3b82f6']

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-stone-500 mb-1">{label}</p>
      <p className="text-2xl font-mono font-medium text-stone-900">{value}</p>
    </div>
  )
}

function exportCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const csv = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('by-client')
  const [preset, setPreset] = useState<Preset>('this_month')
  const [customStart, setCustomStart] = useState(toInputDate(startOfMonth(new Date())))
  const [customEnd, setCustomEnd] = useState(toInputDate(new Date()))
  const [clientId, setClientId] = useState('')

  const { data: clients = [] } = useQuery<{ id: string; name: string; color: string }[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
  })

  const dateParams: Record<string, string> = preset !== 'custom'
    ? { preset }
    : { startDate: customStart, endDate: customEnd }

  const params: Record<string, string> = clientId
    ? { ...dateParams, clientId }
    : dateParams

  const { data, isLoading } = useQuery({
    queryKey: ['report', tab, params],
    queryFn: () => api.get(`/reports/${tab}`, { params }).then(r => r.data),
  })

  const reportData = data?.data || []

  // --- By Client ---
  function renderByClient() {
    const total = reportData.reduce((s: number, c: { totalHours: number }) => s + c.totalHours, 0)
    const chartData = reportData.map((c: { clientName: string; totalHours: number; color: string }) => ({ name: c.clientName, hours: c.totalHours }))
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label="Total hours" value={formatHours(total)} />
          <StatCard label="Clients" value={String(reportData.length)} />
          <StatCard label="Avg per client" value={reportData.length ? formatHours(total / reportData.length) : '0h'} />
        </div>
        <div className="card p-4 mb-6">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, 'Hours']} />
              <Bar dataKey="hours" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">Client</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Hours</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Projects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reportData.map((c: { clientId: string; clientName: string; color: string; totalHours: number; projects: unknown[] }) => (
                <tr key={c.clientId} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.clientName}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatHours(c.totalHours)}</td>
                  <td className="px-4 py-2.5 text-right text-stone-500">{(c.projects as unknown[]).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => exportCSV(reportData.map((c: { clientName: string; totalHours: number }) => ({ client: c.clientName, hours: c.totalHours })), 'report-by-client.csv')} className="btn-secondary mt-4">Export CSV</button>
      </>
    )
  }

  // --- By Group ---
  function renderByGroup() {
    const total = reportData.reduce((s: number, g: { totalHours: number }) => s + g.totalHours, 0)
    const pieData = reportData.map((g: { groupName: string; totalHours: number }, i: number) => ({ name: g.groupName, value: g.totalHours, color: CHART_COLORS[i % CHART_COLORS.length] }))
    return (
      <>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard label="Total hours" value={formatHours(total)} />
          <StatCard label="Groups" value={String(reportData.length)} />
        </div>
        <div className="card p-4 mb-6">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }: { name: string; value: number }) => `${name}: ${value.toFixed(1)}h`}>
                {pieData.map((entry: { color: string }, i: number) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">Group</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Hours</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Clients</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reportData.map((g: { groupId: string | null; groupName: string; totalHours: number; clients: unknown[] }, i: number) => (
                <tr key={g.groupId || 'ungrouped'} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    {g.groupName}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatHours(g.totalHours)}</td>
                  <td className="px-4 py-2.5 text-right text-stone-500">{(g.clients as unknown[]).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => exportCSV(reportData.map((g: { groupName: string; totalHours: number }) => ({ group: g.groupName, hours: g.totalHours })), 'report-by-group.csv')} className="btn-secondary mt-4">Export CSV</button>
      </>
    )
  }

  // --- By Project ---
  function renderByProject() {
    const total = reportData.reduce((s: number, p: { hoursUsed: number }) => s + p.hoursUsed, 0)
    const chartData = reportData.map((p: { projectName: string; hoursUsed: number }) => ({ name: p.projectName, hours: p.hoursUsed }))
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label="Total hours" value={formatHours(total)} />
          <StatCard label="Projects" value={String(reportData.length)} />
          <StatCard label="Over budget" value={String(reportData.filter((p: { budgetPercent: number | null }) => (p.budgetPercent || 0) >= 100).length)} />
        </div>
        <div className="card p-4 mb-6">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 80, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, 'Hours']} />
              <Bar dataKey="hours" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">Project</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">Client</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Hours</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reportData.map((p: { projectId: string; projectName: string; clientName: string; color: string; hoursUsed: number; budgetHours: number | null; budgetPercent: number | null; type: string }) => (
                <tr key={p.projectId} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.projectName}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{p.clientName}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatHours(p.hoursUsed)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {p.budgetPercent !== null ? (
                      <span className={p.budgetPercent >= 100 ? 'text-red-600 font-medium' : p.budgetPercent >= 80 ? 'text-amber-600' : 'text-stone-500'}>
                        {p.budgetPercent}%
                      </span>
                    ) : <span className="text-stone-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => exportCSV(reportData.map((p: { projectName: string; clientName: string; hoursUsed: number; budgetPercent: number | null }) => ({ project: p.projectName, client: p.clientName, hours: p.hoursUsed, budget_pct: p.budgetPercent })), 'report-by-project.csv')} className="btn-secondary mt-4">Export CSV</button>
      </>
    )
  }

  // --- By Task ---
  function renderByTask() {
    const total = reportData.reduce((s: number, t: { totalHours: number }) => s + t.totalHours, 0)
    const chartData = reportData.map((t: { taskName: string; totalHours: number }) => ({ name: t.taskName, hours: t.totalHours }))
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label="Total hours" value={formatHours(total)} />
          <StatCard label="Task types" value={String(reportData.length)} />
          <StatCard label="Billable hours" value={formatHours(reportData.filter((t: { isBillable: boolean }) => t.isBillable).reduce((s: number, t: { totalHours: number }) => s + t.totalHours, 0))} />
        </div>
        <div className="card p-4 mb-6">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, 'Hours']} />
              <Bar dataKey="hours" fill="#db2777" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">Task</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Hours</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Projects</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Billable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reportData.map((t: { taskId: string; taskName: string; totalHours: number; projectCount: number; isBillable: boolean }) => (
                <tr key={t.taskId} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5">{t.taskName}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatHours(t.totalHours)}</td>
                  <td className="px-4 py-2.5 text-right text-stone-500">{t.projectCount}</td>
                  <td className="px-4 py-2.5 text-right">{t.isBillable ? <span className="badge-green">Yes</span> : <span className="text-stone-400 text-xs">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => exportCSV(reportData.map((t: { taskName: string; totalHours: number; isBillable: boolean }) => ({ task: t.taskName, hours: t.totalHours, billable: t.isBillable })), 'report-by-task.csv')} className="btn-secondary mt-4">Export CSV</button>
      </>
    )
  }

  // --- By Member ---
  function renderByMember() {
    const total = reportData.reduce((s: number, u: { totalHours: number }) => s + u.totalHours, 0)
    const chartData = reportData.map((u: { userName: string; totalHours: number }) => ({ name: u.userName, hours: u.totalHours }))
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label="Total hours" value={formatHours(total)} />
          <StatCard label="Team members" value={String(reportData.length)} />
          <StatCard label="Avg per member" value={reportData.length ? formatHours(total / reportData.length) : '0h'} />
        </div>
        <div className="card p-4 mb-6">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, 'Hours']} />
              <Bar dataKey="hours" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {reportData.map((u: { userId: string; userName: string; avatarColor: string; totalHours: number; projects: { projectId: string; projectName: string; clientName: string; hours: number }[] }) => (
            <div key={u.userId} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-stone-50 border-b border-stone-100">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: u.avatarColor }}>
                  {u.userName[0]}
                </div>
                <span className="font-medium text-stone-900 flex-1">{u.userName}</span>
                <span className="font-mono text-sm font-medium text-stone-700">{formatHours(u.totalHours)}</span>
              </div>
              <div className="divide-y divide-stone-100">
                {u.projects.map(p => (
                  <div key={p.projectId} className="flex items-center px-4 py-2 text-sm">
                    <span className="flex-1 text-stone-700">{p.clientName} — {p.projectName}</span>
                    <span className="font-mono text-stone-600">{formatHours(p.hours)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => exportCSV(reportData.map((u: { userName: string; totalHours: number }) => ({ member: u.userName, hours: u.totalHours })), 'report-by-member.csv')} className="btn-secondary mt-4">Export CSV</button>
      </>
    )
  }

  // --- Detail Log ---
  function renderDetailLog() {
    const total = data?.total || 0
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label="Total hours" value={formatHours(total)} />
          <StatCard label="Entries" value={String(reportData.length)} />
          <StatCard label="Billable hours" value={formatHours(reportData.filter((e: { task: { isBillable: boolean } }) => e.task?.isBillable).reduce((s: number, e: { hours: number }) => s + e.hours, 0))} />
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">User</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">Client / Project</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">Task</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-stone-500">Notes</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-stone-500">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {reportData.map((e: { id: string; date: string; user: { name: string; avatarColor: string }; project: { name: string; color: string; client: { name: string } }; task: { name: string; isBillable: boolean }; hours: number; notes?: string }) => (
                  <tr key={e.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5 text-stone-500 whitespace-nowrap">{format(new Date(e.date), 'MMM d')}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: e.user.avatarColor }}>{e.user.name[0]}</div>
                        <span className="whitespace-nowrap">{e.user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.project.color }} />
                        <span className="whitespace-nowrap">{e.project.client.name} — {e.project.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {e.task.name}
                        {!e.task.isBillable && <span className="text-xs text-stone-400">(NB)</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-stone-400 max-w-[180px] truncate">{e.notes || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatHours(e.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <button onClick={() => exportCSV(reportData.map((e: { date: string; user: { name: string }; project: { name: string; client: { name: string } }; task: { name: string }; hours: number; notes?: string }) => ({ date: e.date, user: e.user.name, client: e.project.client.name, project: e.project.name, task: e.task.name, hours: e.hours, notes: e.notes })), 'report-detail-log.csv')} className="btn-secondary mt-4">Export CSV</button>
      </>
    )
  }

  const renderers: Record<ReportTab, () => React.ReactNode> = {
    'by-client': renderByClient,
    'by-group': renderByGroup,
    'by-project': renderByProject,
    'by-task': renderByTask,
    'by-member': renderByMember,
    'detail-log': renderDetailLog,
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-stone-900 mb-6">Reports</h1>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'ytd', 'custom'] as Preset[]).map(p => (
          <button key={p} onClick={() => setPreset(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${preset === p ? 'bg-blue-600 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
            {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'this_week' ? 'This Week' : p === 'this_month' ? 'This Month' : p === 'last_month' ? 'Last Month' : p === 'ytd' ? 'YTD' : 'Custom'}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input w-auto" />
            <span className="text-stone-400">—</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input w-auto" />
          </div>
        )}
      </div>

      {/* Client filter */}
      <div className="flex items-center gap-2 mb-6">
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="input w-auto text-sm"
        >
          <option value="">All clients</option>
          {clients.map((c: { id: string; name: string; color: string }) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {clientId && (
          <button onClick={() => setClientId('')} className="text-sm text-stone-400 hover:text-stone-600 transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="card p-4"><div className="skeleton h-10 w-full" /></div>)}
          </div>
          <div className="card p-4"><div className="skeleton h-64 w-full" /></div>
        </div>
      ) : reportData.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="font-medium">No data for this period</p>
          <p className="text-sm mt-1">Try a different date range</p>
        </div>
      ) : renderers[tab]()}
    </div>
  )
}
