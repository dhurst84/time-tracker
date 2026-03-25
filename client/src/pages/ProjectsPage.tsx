import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import BudgetBar from '../components/BudgetBar'
import ProjectForm from '../components/ProjectForm'
import { formatHours } from '../lib/utils'

interface Task { id: string; name: string; isBillable: boolean }
interface Project {
  id: string
  name: string
  clientId: string
  type: string
  recurringPeriod: string
  budgetHours?: number
  notes?: string
  isActive: boolean
  color: string
  client: { id: string; name: string; color: string }
  tasks: Task[]
  _count: { timeEntries: number }
  hoursUsed: number
}
interface SimpleClient { id: string; name: string }

export default function ProjectsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects-page', debouncedSearch, typeFilter, clientFilter, includeArchived],
    queryFn: () => api.get('/projects', {
      params: {
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(typeFilter && { type: typeFilter }),
        ...(clientFilter && { clientId: clientFilter }),
        ...(includeArchived && { includeArchived: 'true' }),
      },
    }).then(r => r.data),
  })

  const { data: clients = [] } = useQuery<SimpleClient[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then(r => r.data),
  })

  // When viewing archived, API returns all — filter client-side to only show inactive
  const displayedProjects = includeArchived
    ? projects.filter(p => !p.isActive)
    : projects

  const createProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/projects', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects-page'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowNewProject(false)
      toast.success('Project created')
    },
    onError: () => toast.error('Failed to create project'),
  })

  const updateProject = useMutation({
    mutationFn: ({ projectId, ...data }: Record<string, unknown> & { projectId: string }) =>
      api.patch(`/projects/${projectId}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects-page'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      setEditProject(null)
      toast.success('Project updated')
    },
    onError: () => toast.error('Failed to update project'),
  })

  const archiveProject = useMutation({
    mutationFn: ({ projectId, isActive }: { projectId: string; isActive: boolean }) =>
      api.patch(`/projects/${projectId}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects-page'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project updated')
    },
    onError: () => toast.error('Failed to update project'),
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-stone-900">Projects</h1>
        <button onClick={() => setShowNewProject(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New project
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-9"
          placeholder="Search projects or clients..."
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={includeArchived ? 'archived' : 'active'}
          onChange={e => setIncludeArchived(e.target.value === 'archived')}
          className="input w-auto"
        >
          <option value="active">Active projects ({!includeArchived ? displayedProjects.length : ''})</option>
          <option value="archived">Archived projects ({includeArchived ? displayedProjects.length : ''})</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-auto">
          <option value="">All types</option>
          <option value="one_time">One-time</option>
          <option value="recurring">Recurring</option>
        </select>
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="input w-auto">
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* New project modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">New Project</h2>
            <ProjectForm
              showClientSelect
              onSave={data => createProject.mutate(data)}
              onCancel={() => setShowNewProject(false)}
            />
          </div>
        </div>
      )}

      {/* Edit project modal */}
      {editProject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-5">
            <h2 className="font-semibold text-stone-900 mb-4">Edit Project</h2>
            <ProjectForm
              initial={{ ...editProject, clientId: editProject.clientId }}
              submitLabel="Save changes"
              showClientSelect
              onSave={data => updateProject.mutate({ projectId: editProject.id, ...data })}
              onCancel={() => setEditProject(null)}
            />
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4">
              <div className="skeleton h-16 w-full" />
            </div>
          ))}
        </div>
      ) : displayedProjects.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="font-medium text-stone-600">No projects found</p>
          <p className="text-sm text-stone-400 mt-1">Try adjusting your filters or create a new project.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedProjects.map(project => {
            const remaining = project.budgetHours != null ? project.budgetHours - project.hoursUsed : null
            const isOver = remaining !== null && remaining < 0
            return (
              <div key={project.id} className={`card p-4 flex items-center gap-4 ${!project.isActive ? 'opacity-60' : ''}`}>
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-blue-700">
                      {project.name}
                    </Link>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${project.type === 'recurring' ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-600'}`}>
                      {project.type === 'recurring' ? 'Recurring' : 'One-time'}
                    </span>
                  </div>
                  <Link to={`/clients/${project.clientId}`} className="text-xs text-stone-500 hover:text-stone-700 mt-0.5 block">
                    {project.client.name}
                  </Link>
                  {project.budgetHours != null && (
                    <div className="mt-1.5">
                      <BudgetBar used={project.hoursUsed} budget={project.budgetHours} showLabel={false} />
                      <p className="text-xs text-stone-400 mt-0.5">{formatHours(project.hoursUsed)} used of {project.budgetHours}h</p>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm font-medium text-stone-700">{formatHours(project.hoursUsed)}</p>
                  {remaining !== null && (
                    <p className={`text-xs ${isOver ? 'text-red-500' : 'text-stone-400'}`}>
                      {isOver ? `${formatHours(Math.abs(remaining))} over` : `${formatHours(remaining)} left`}
                    </p>
                  )}
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
