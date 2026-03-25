import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import BudgetBar from '../components/BudgetBar'
import ProjectForm from '../components/ProjectForm'
import { formatHours } from '../lib/utils'

interface ClientGroup { id: string; name: string; color: string }
interface ProjectClient {
  id: string; name: string; color: string
  group?: ClientGroup | null
}
interface Task { id: string; name: string; isBillable: boolean }
interface Project {
  id: string; name: string; clientId: string; type: string; recurringPeriod: string
  budgetHours?: number; notes?: string; isActive: boolean; color: string
  client: ProjectClient
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

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

  const { data: groups = [] } = useQuery<ClientGroup[]>({
    queryKey: ['client-groups'],
    queryFn: () => api.get('/client-groups').then(r => r.data),
  })

  // When viewing archived, API returns all — filter client-side to only show inactive
  const displayedProjects = includeArchived
    ? projects.filter(p => !p.isActive)
    : projects

  const grouped = useMemo(() => {
    const map = new Map<string, { group: ClientGroup | null; projects: Project[] }>()
    for (const g of groups) {
      map.set(g.id, { group: g, projects: [] })
    }
    map.set('ungrouped', { group: null, projects: [] })
    for (const p of displayedProjects) {
      const key = p.client.group?.id ?? 'ungrouped'
      if (!map.has(key)) map.set(key, { group: p.client.group ?? null, projects: [] })
      map.get(key)!.projects.push(p)
    }
    for (const [key, val] of map) {
      if (val.projects.length === 0) map.delete(key)
    }
    return map
  }, [displayedProjects, groups])

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

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
          <option value="one_time">One-Time (Fixed Scope)</option>
          <option value="recurring">Ongoing (Recurring)</option>
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
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4">
              <div className="skeleton h-10 w-full" />
            </div>
          ))}
        </div>
      ) : grouped.size === 0 ? (
        <div className="card p-12 text-center">
          <p className="font-medium text-stone-600">No projects found</p>
          <p className="text-sm text-stone-400 mt-1">Try adjusting your filters or create a new project.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {Array.from(grouped.entries()).map(([key, { group, projects: groupProjects }]) => {
            const groupHoursUsed = groupProjects.reduce((sum, p) => sum + p.hoursUsed, 0)
            const groupBudget = groupProjects.reduce((sum, p) => sum + (p.budgetHours || 0), 0)
            const groupPct = groupBudget > 0 ? Math.min(100, (groupHoursUsed / groupBudget) * 100) : 0
            const groupColor = group?.color ?? '#a8a29e'
            const groupName = group?.name ?? 'Ungrouped'
            const isExpanded = expandedGroups.has(key)

            return (
              <div key={key} className="card overflow-hidden">
                {/* Group header */}
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
                        {groupProjects.length} project{groupProjects.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {groupBudget > 0 && (
                      <div className="mt-1.5 pr-2">
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${groupPct >= 100 ? 'bg-red-500' : groupPct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${groupPct}%` }}
                          />
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">{formatHours(groupHoursUsed)} of {formatHours(groupBudget)} budget</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm font-semibold text-stone-900">{formatHours(groupHoursUsed)}</p>
                    <p className="text-xs text-stone-400">total</p>
                  </div>
                </button>

                {/* Expanded project rows */}
                {isExpanded && (
                  <div className="border-t border-stone-100 divide-y divide-stone-100">
                    {groupProjects.map(project => {
                      const remaining = project.budgetHours != null ? project.budgetHours - project.hoursUsed : null
                      const isOver = remaining !== null && remaining < 0
                      return (
                        <div key={project.id} className={`flex items-center gap-4 pl-10 pr-4 py-3 ${!project.isActive ? 'opacity-60' : ''}`}>
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link to={`/projects/${project.id}`} className="font-medium text-stone-900 hover:text-blue-700">
                                {project.name}
                              </Link>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${project.type === 'recurring' ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-600'}`}>
                                {project.type === 'recurring' ? 'Ongoing' : 'One-Time'}
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
          })}
        </div>
      )}
    </div>
  )
}
