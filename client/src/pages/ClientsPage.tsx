import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { avatarInitials, formatHours, toInputDate } from '../lib/utils'

interface ClientGroup { id: string; name: string; color: string }
interface Client {
  id: string; name: string; email?: string; color: string; isActive: boolean
  group?: ClientGroup
  _count: { projects: number }
}
interface MTDEntry {
  hours: number
  isRunning: boolean
  project: { client: { id: string } }
}
interface ProjectForBudget {
  clientId: string
  budgetHours: number | null
}

const COLORS = ['#0d9488','#7c3aed','#db2777','#ea580c','#16a34a','#0ea5e9','#ca8a04','#dc2626']

interface ClientFormData extends Partial<Client> { groupId?: string }

function ClientForm({ initial, groups, onSave, onCancel }: {
  initial?: Partial<Client>
  groups: ClientGroup[]
  onSave: (data: ClientFormData) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [color, setColor] = useState(initial?.color || COLORS[0])
  const [groupId, setGroupId] = useState(initial?.group?.id || '')

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ name, email, color, groupId: groupId || undefined }) }} className="space-y-3">
      <div>
        <label className="label">Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} className="input" required />
      </div>
      <div>
        <label className="label">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" />
      </div>
      <div>
        <label className="label">Group</label>
        <select value={groupId} onChange={e => setGroupId(e.target.value)} className="input">
          <option value="">No group</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex gap-2">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button type="submit" className="btn-primary flex-1 justify-center">Save</button>
      </div>
    </form>
  )
}

export default function ClientsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', showArchived],
    queryFn: () => api.get('/clients', { params: showArchived ? { includeArchived: true } : {} }).then(r => r.data),
  })

  const displayedClients = useMemo(
    () => showArchived ? clients.filter(c => !c.isActive) : clients,
    [clients, showArchived]
  )

  const { data: groups = [] } = useQuery<ClientGroup[]>({
    queryKey: ['client-groups'],
    queryFn: () => api.get('/client-groups').then(r => r.data),
  })

  // MTD time entries
  const mtdStart = toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const mtdEnd = toInputDate(new Date())
  const { data: mtdEntries = [] } = useQuery<MTDEntry[]>({
    queryKey: ['mtd-entries', mtdStart, mtdEnd],
    queryFn: () => api.get('/time-entries', { params: { startDate: mtdStart, endDate: mtdEnd } }).then(r => r.data),
  })

  const { data: allProjects = [] } = useQuery<ProjectForBudget[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  const clientBudgetMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of allProjects) {
      if (p.budgetHours && p.clientId) {
        map[p.clientId] = (map[p.clientId] || 0) + p.budgetHours
      }
    }
    return map
  }, [allProjects])

  const clientHoursMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const entry of mtdEntries) {
      if (!entry.isRunning) {
        const cid = entry.project.client.id
        map[cid] = (map[cid] || 0) + entry.hours
      }
    }
    return map
  }, [mtdEntries])

  // Group clients: keyed by group id or 'ungrouped'
  const grouped = useMemo(() => {
    const map = new Map<string, { group: ClientGroup | null; clients: Client[] }>()

    // Add known groups first to preserve order
    for (const g of groups) {
      map.set(g.id, { group: g, clients: [] })
    }
    // Ungrouped bucket
    map.set('ungrouped', { group: null, clients: [] })

    for (const c of displayedClients) {
      const key = c.group?.id ?? 'ungrouped'
      if (!map.has(key)) map.set(key, { group: c.group ?? null, clients: [] })
      map.get(key)!.clients.push(c)
    }

    // Drop empty buckets
    for (const [key, val] of map) {
      if (val.clients.length === 0) map.delete(key)
    }

    return map
  }, [displayedClients, groups])

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const createMutation = useMutation({
    mutationFn: (data: Partial<Client>) => api.post('/clients', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setShowCreate(false); toast.success('Client created') },
    onError: () => toast.error('Failed to create client'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Client> & { id: string }) => api.patch(`/clients/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setEditClient(null); toast.success('Client updated') },
    onError: () => toast.error('Failed to update client'),
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/clients/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client updated') },
    onError: () => toast.error('Failed to update'),
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {showArchived && (
            <button onClick={() => setShowArchived(false)} className="text-stone-400 hover:text-stone-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <h1 className="text-xl font-semibold text-stone-900">{showArchived ? 'Archived Clients' : 'Clients'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!showArchived && (
            <>
              <button onClick={() => setShowArchived(true)} className="btn-secondary">
                Archived
              </button>
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New client
              </button>
            </>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">New Client</h2>
            <ClientForm groups={groups} onSave={data => createMutation.mutate(data)} onCancel={() => setShowCreate(false)} />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">Edit Client</h2>
            <ClientForm
              initial={editClient}
              groups={groups}
              onSave={data => updateMutation.mutate({ id: editClient.id, ...data })}
              onCancel={() => setEditClient(null)}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => <div key={i} className="card p-4"><div className="skeleton h-10 w-full" /></div>)}
        </div>
      ) : grouped.size === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="font-medium">{showArchived ? 'No archived clients' : 'No clients found'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {Array.from(grouped.entries()).map(([key, { group, clients: groupClients }]) => {
            const isExpanded = expandedGroups.has(key)
            const groupTotal = groupClients.reduce((sum, c) => sum + (clientHoursMap[c.id] || 0), 0)
            const groupBudget = groupClients.reduce((sum, c) => sum + (clientBudgetMap[c.id] || 0), 0)
            const groupPct = groupBudget > 0 ? Math.min(100, (groupTotal / groupBudget) * 100) : 0
            const groupColor = group?.color ?? '#a8a29e'
            const groupName = group?.name ?? 'Ungrouped'

            return (
              <div key={key} className="card overflow-hidden">
                {/* Group header row — always visible, clickable to expand */}
                <button
                  type="button"
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
                >
                  <svg
                    className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: groupColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-stone-900">{groupName}</span>
                      <span className="text-xs text-stone-400">
                        {groupClients.length} client{groupClients.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {groupBudget > 0 && (
                      <div className="mt-1.5 pr-2">
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${groupPct >= 100 ? 'bg-red-500' : groupPct >= 80 ? 'bg-amber-500' : 'bg-teal-500'}`}
                            style={{ width: `${groupPct}%` }}
                          />
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">{formatHours(groupTotal)} of {formatHours(groupBudget)} budget</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-semibold text-stone-900">{formatHours(groupTotal)}</p>
                    <p className="text-xs text-stone-400">this month</p>
                  </div>
                </button>

                {/* Expanded client rows */}
                {isExpanded && (
                  <div className="border-t border-stone-100 divide-y divide-stone-100">
                    {groupClients.map(client => {
                      const hours = clientHoursMap[client.id] || 0
                      const budget = clientBudgetMap[client.id] || 0
                      const pct = budget > 0 ? Math.min(100, (hours / budget) * 100) : 0
                      return (
                        <div key={client.id} className={`flex items-start gap-4 pl-10 pr-4 py-3 ${!client.isActive ? 'opacity-60' : ''}`}>
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: client.color }}
                          >
                            {avatarInitials(client.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link to={`/clients/${client.id}`} className="text-sm font-medium text-stone-900 hover:text-teal-700 block truncate">
                              {client.name}
                            </Link>
                            <div className="flex items-center gap-3 text-xs text-stone-400 mt-0.5">
                              <span>{client._count.projects} project{client._count.projects !== 1 ? 's' : ''}</span>
                              <span>·</span>
                              <button onClick={() => setEditClient(client)} className="hover:text-stone-700 transition-colors">Edit</button>
                              <button
                                onClick={() => archiveMutation.mutate({ id: client.id, isActive: !client.isActive })}
                                className="hover:text-stone-700 transition-colors"
                              >
                                {client.isActive ? 'Archive' : 'Restore'}
                              </button>
                            </div>
                            {budget > 0 && (
                              <div className="mt-2 pr-2">
                                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-teal-500'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <p className="text-xs text-stone-400 mt-0.5">{formatHours(hours)} of {formatHours(budget)} budget</p>
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono text-sm font-semibold text-stone-900">{formatHours(hours)}</p>
                            <p className="text-xs text-stone-400">this month</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
