import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import BudgetBar from '../components/BudgetBar'
import ClientAvatar from '../components/ClientAvatar'
import ProjectForm from '../components/ProjectForm'
import { formatHours } from '../lib/utils'

interface Task { id: string; name: string; isBillable: boolean }
interface Project {
  id: string; name: string; color: string; type: string; recurringPeriod: string
  budgetHours?: number; notes?: string; isActive: boolean
  tasks: Task[]
  _count: { timeEntries: number }
}
interface ClientGroup { id: string; name: string }
interface Client {
  id: string; name: string; email?: string; website?: string; color: string
  group?: { id: string; name: string }
  projects: Project[]
}

const COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0ea5e9','#ca8a04','#dc2626']

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [showNewProject, setShowNewProject] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [showEditClient, setShowEditClient] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editColor, setEditColor] = useState(COLORS[0])
  const [editGroupId, setEditGroupId] = useState('')

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then(r => r.data),
  })

  const { data: groups = [] } = useQuery<ClientGroup[]>({
    queryKey: ['client-groups'],
    queryFn: () => api.get('/client-groups').then(r => r.data),
  })

  const { data: projectHours = {} } = useQuery<Record<string, number>>({
    queryKey: ['project-hours', id],
    queryFn: async () => {
      if (!client) return {}
      const results: Record<string, number> = {}
      const entries = await api.get('/time-entries', {
        params: { startDate: '2020-01-01', endDate: new Date().toISOString().split('T')[0] }
      }).then(r => r.data)
      for (const e of entries) {
        if (!results[e.projectId]) results[e.projectId] = 0
        results[e.projectId] += e.hours
      }
      return results
    },
    enabled: !!client,
  })

  const updateClient = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/clients/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      setShowEditClient(false)
      toast.success('Client updated')
    },
    onError: () => toast.error('Failed to update client'),
  })

  function openEditClient() {
    if (!client) return
    setEditName(client.name)
    setEditEmail(client.email || '')
    setEditWebsite(client.website || '')
    setEditColor(client.color)
    setEditGroupId(client.group?.id || '')
    setShowEditClient(true)
  }

  const createProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/projects', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); setShowNewProject(false); toast.success('Project created') },
    onError: () => toast.error('Failed to create project'),
  })

  const updateProject = useMutation({
    mutationFn: ({ projectId, ...data }: Record<string, unknown> & { projectId: string }) =>
      api.patch(`/projects/${projectId}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      setEditProject(null)
      toast.success('Project updated')
    },
    onError: () => toast.error('Failed to update project'),
  })

  const archiveProject = useMutation({
    mutationFn: ({ projectId, isActive }: { projectId: string; isActive: boolean }) =>
      api.patch(`/projects/${projectId}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); toast.success('Project updated') },
    onError: () => toast.error('Failed to update project'),
  })

  if (isLoading) return <div className="max-w-3xl mx-auto px-4 py-6"><div className="skeleton h-8 w-48 mb-6" /></div>
  if (!client) return <div className="p-8 text-stone-400">Client not found</div>

  const totalHours = Object.values(projectHours).reduce((s, h) => s + h, 0)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Clients
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <ClientAvatar name={client.name} color={client.color} website={client.website} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-stone-900">{client.name}</h1>
            <button onClick={openEditClient} className="btn-ghost text-xs">Edit</button>
          </div>
          {client.group && <p className="text-sm text-stone-500">{client.group.name}</p>}
          {client.email && <p className="text-sm text-stone-400">{client.email}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-medium text-stone-900">{formatHours(totalHours)}</p>
          <p className="text-xs text-stone-400">total logged</p>
        </div>
      </div>

      {/* Edit client modal */}
      {showEditClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">Edit Client</h2>
            <form onSubmit={e => { e.preventDefault(); updateClient.mutate({ name: editName, email: editEmail, website: editWebsite || undefined, color: editColor, groupId: editGroupId || undefined }) }} className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Website</label>
                <input type="text" value={editWebsite} onChange={e => setEditWebsite(e.target.value)} className="input" placeholder="e.g. acme.com" />
              </div>
              <div>
                <label className="label">Group</label>
                <select value={editGroupId} onChange={e => setEditGroupId(e.target.value)} className="input">
                  <option value="">No group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
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
                <button type="button" onClick={() => setShowEditClient(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-stone-900">Projects</h2>
        <button onClick={() => setShowNewProject(true)} className="btn-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New project
        </button>
      </div>

      {/* New project modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">New Project</h2>
            <ProjectForm clientId={client.id} onSave={data => createProject.mutate(data)} onCancel={() => setShowNewProject(false)} />
          </div>
        </div>
      )}

      {/* Edit project modal */}
      {editProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">Edit Project</h2>
            <ProjectForm
              clientId={client.id}
              initial={editProject}
              submitLabel="Save changes"
              onSave={data => updateProject.mutate({ projectId: editProject.id, ...data })}
              onCancel={() => setEditProject(null)}
            />
          </div>
        </div>
      )}

      {client.projects.length === 0 ? (
        <div className="card p-8 text-center text-stone-400">
          <p>No projects yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {client.projects.map(project => {
            const used = projectHours[project.id] || 0
            return (
              <div key={project.id} className={`card p-4 flex items-center gap-4 ${!project.isActive ? 'opacity-60' : ''}`}>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                <div className="flex-1 min-w-0">
                  <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-blue-700 block truncate">
                    {project.name}
                  </Link>
                  <p className="text-xs text-stone-500 capitalize mt-0.5">{project.type.replace('_', ' ')} · {project.tasks.length} tasks</p>
                  {project.budgetHours && (
                    <div className="mt-1.5">
                      <BudgetBar used={used} budget={project.budgetHours} />
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm font-medium text-stone-700">{formatHours(used)}</p>
                  {project.budgetHours && <p className="text-xs text-stone-400">of {project.budgetHours}h</p>}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 border-l border-stone-100 pl-4">
                  <button
                    onClick={() => setEditProject(project)}
                    className="text-xs text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => archiveProject.mutate({ projectId: project.id, isActive: !project.isActive })}
                    className="text-xs text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    {project.isActive ? 'Archive' : 'Restore'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
