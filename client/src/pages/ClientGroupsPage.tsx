import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { formatHours, toInputDate } from '../lib/utils'

interface ClientGroup {
  id: string
  name: string
  color: string
  description?: string
  _count: { clients: number }
}
interface ClientForMapping {
  id: string
  groupId: string | null
}
interface MTDEntry {
  hours: number
  isRunning: boolean
  project: { client: { id: string; groupId: string | null } }
}

const COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0ea5e9','#ca8a04','#dc2626']

function GroupForm({ initial, onSave, onCancel }: {
  initial?: Partial<ClientGroup>
  onSave: (data: { name: string; color: string; description: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [color, setColor] = useState(initial?.color || COLORS[0])

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ name, color, description }) }} className="space-y-3">
      <div>
        <label className="label">Name *</label>
        <input value={name} onChange={e => setName(e.target.value)} className="input" required />
      </div>
      <div>
        <label className="label">Description</label>
        <input value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Optional" />
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

export default function ClientGroupsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editGroup, setEditGroup] = useState<ClientGroup | null>(null)
  const [deleteGroup, setDeleteGroup] = useState<ClientGroup | null>(null)

  const { data: groups = [], isLoading } = useQuery<ClientGroup[]>({
    queryKey: ['client-groups'],
    queryFn: () => api.get('/client-groups').then(r => r.data),
  })

  // Fetch clients to map clientId → groupId
  const { data: allClients = [] } = useQuery<ClientForMapping[]>({
    queryKey: ['clients-for-mapping'],
    queryFn: () => api.get('/clients', { params: { includeArchived: true } }).then(r => r.data),
  })

  // MTD time entries
  const mtdStart = toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const mtdEnd = toInputDate(new Date())
  const { data: mtdEntries = [] } = useQuery<MTDEntry[]>({
    queryKey: ['mtd-entries', mtdStart, mtdEnd],
    queryFn: () => api.get('/time-entries', { params: { startDate: mtdStart, endDate: mtdEnd } }).then(r => r.data),
  })

  // Build groupId → hours map
  const groupHoursMap = useMemo(() => {
    const clientToGroup: Record<string, string> = {}
    for (const c of allClients) {
      if (c.groupId) clientToGroup[c.id] = c.groupId
    }
    const map: Record<string, number> = {}
    for (const entry of mtdEntries) {
      if (!entry.isRunning) {
        const cid = entry.project.client.id
        const gid = clientToGroup[cid]
        if (gid) map[gid] = (map[gid] || 0) + entry.hours
      }
    }
    return map
  }, [mtdEntries, allClients])

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/client-groups', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-groups'] }); setShowCreate(false); toast.success('Group created') },
    onError: () => toast.error('Failed to create group'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & object) => api.patch(`/client-groups/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-groups'] }); setEditGroup(null); toast.success('Group updated') },
    onError: () => toast.error('Failed to update group'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/client-groups/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client-groups'] }); qc.invalidateQueries({ queryKey: ['clients'] }); setDeleteGroup(null); toast.success('Group deleted') },
    onError: () => toast.error('Failed to delete group'),
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-stone-900">Client Groups</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New group
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">New Group</h2>
            <GroupForm onSave={data => createMutation.mutate(data)} onCancel={() => setShowCreate(false)} />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editGroup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">Edit Group</h2>
            <GroupForm
              initial={editGroup}
              onSave={data => updateMutation.mutate({ id: editGroup.id, ...data })}
              onCancel={() => setEditGroup(null)}
            />
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteGroup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-5">
            <h2 className="font-semibold text-stone-900 mb-2">Delete group?</h2>
            <p className="text-sm text-stone-500 mb-4">
              <span className="font-medium text-stone-700">{deleteGroup.name}</span> will be deleted.
              {deleteGroup._count.clients > 0 && (
                <> The {deleteGroup._count.clients} client{deleteGroup._count.clients !== 1 ? 's' : ''} in this group will be unassigned.</>
              )}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteGroup(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteGroup.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 justify-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => <div key={i} className="card p-4"><div className="skeleton h-10 w-full" /></div>)}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <p className="font-medium">No groups yet</p>
          <p className="text-sm mt-1">Create a group to organize your clients</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(group => (
            <div key={group.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ backgroundColor: group.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-900">{group.name}</p>
                <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5 flex-wrap">
                  {group.description && <span>{group.description}</span>}
                  <Link to={`/clients?group=${group.id}`} className="hover:text-blue-700 transition-colors">
                    {group._count.clients} client{group._count.clients !== 1 ? 's' : ''}
                  </Link>
                  <span>·</span>
                  <button onClick={() => setEditGroup(group)} className="hover:text-stone-900 transition-colors">Edit</button>
                  <button onClick={() => setDeleteGroup(group)} className="hover:text-red-600 transition-colors">Delete</button>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-mono text-base font-semibold text-stone-900">{formatHours(groupHoursMap[group.id] || 0)}</p>
                <p className="text-xs text-stone-400">this month</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
