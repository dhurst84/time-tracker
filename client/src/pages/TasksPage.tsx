import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

interface TaskTemplate {
  id: string
  name: string
  isBillable: boolean
  isDefault: boolean
  isActive: boolean
}

interface ProjectWithTasks {
  id: string
  tasks: { name: string }[]
}

export default function TasksPage() {
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isBillable, setIsBillable] = useState(true)
  const [isDefault, setIsDefault] = useState(false)
  const [addToExisting, setAddToExisting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: templates = [], isLoading } = useQuery<TaskTemplate[]>({
    queryKey: ['task-templates'],
    queryFn: () => api.get('/task-templates').then(r => r.data),
  })

  const { data: allProjects = [] } = useQuery<ProjectWithTasks[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; isBillable: boolean; isDefault: boolean }) =>
      api.post('/task-templates', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-templates'] })
    },
    onError: () => toast.error('Failed to create template'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; isBillable: boolean; isDefault: boolean }) =>
      api.patch(`/task-templates/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-templates'] })
      resetForm()
      toast.success('Task template updated')
    },
    onError: () => toast.error('Failed to update template'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/task-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-templates'] })
      setDeleteConfirm(null)
      toast.success('Task template removed')
    },
    onError: () => toast.error('Failed to remove template'),
  })

  function resetForm() {
    setShowForm(false)
    setEditId(null)
    setName('')
    setIsBillable(true)
    setIsDefault(false)
    setAddToExisting(false)
  }

  function startEdit(t: TaskTemplate) {
    setEditId(t.id)
    setName(t.name)
    setIsBillable(t.isBillable)
    setIsDefault(t.isDefault)
    setAddToExisting(false)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return toast.error('Task name is required')

    if (editId) {
      updateMutation.mutate({ id: editId, name: trimmedName, isBillable, isDefault })
      return
    }

    try {
      await createMutation.mutateAsync({ name: trimmedName, isBillable, isDefault })

      if (addToExisting && allProjects.length > 0) {
        const projectsToAdd = allProjects.filter(
          p => !p.tasks.some(t => t.name.toLowerCase() === trimmedName.toLowerCase())
        )
        if (projectsToAdd.length > 0) {
          await Promise.all(
            projectsToAdd.map(p => api.post('/tasks', { name: trimmedName, projectId: p.id, isBillable }))
          )
          qc.invalidateQueries({ queryKey: ['projects'] })
          toast.success(`Task template created and added to ${projectsToAdd.length} existing project${projectsToAdd.length !== 1 ? 's' : ''}`)
        } else {
          toast.success('Task template created (already exists on all projects)')
        }
      } else {
        toast.success('Task template created')
      }

      resetForm()
    } catch {
      // error already handled by mutation
    }
  }

  const defaultTemplates = templates.filter(t => t.isDefault)
  const otherTemplates = templates.filter(t => !t.isDefault)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Task Templates</h1>
          <p className="text-sm text-stone-500">Manage reusable tasks across all projects</p>
        </div>
        {isAdmin && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New task
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && isAdmin && (
        <div className="card p-4 mb-6">
          <h2 className="font-medium text-stone-900 mb-4">{editId ? 'Edit task template' : 'New task template'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Task name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Design, Development, QA"
                className="input"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isBillable}
                  onChange={e => setIsBillable(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-stone-700">Billable</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-stone-700">Add to new projects automatically</span>
              </label>
              {!editId && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addToExisting}
                    onChange={e => setAddToExisting(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-stone-700">Add to all existing projects</span>
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="btn-primary"
              >
                {editId ? 'Save changes' : 'Create template'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          <p className="font-medium">No task templates yet</p>
          {isAdmin && <p className="text-sm mt-1">Create templates to quickly add tasks to new projects</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {defaultTemplates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Default tasks</h2>
                <span className="text-xs text-stone-400 bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">Auto-added to new projects</span>
              </div>
              <div className="card divide-y divide-stone-100">
                {defaultTemplates.map(t => (
                  <TemplateRow key={t.id} template={t} isAdmin={isAdmin} onEdit={startEdit} onDelete={setDeleteConfirm} />
                ))}
              </div>
            </div>
          )}
          {otherTemplates.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Other templates</h2>
              <div className="card divide-y divide-stone-100">
                {otherTemplates.map(t => (
                  <TemplateRow key={t.id} template={t} isAdmin={isAdmin} onEdit={startEdit} onDelete={setDeleteConfirm} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-5">
            <h2 className="font-semibold text-stone-900 mb-2">Remove template?</h2>
            <p className="text-sm text-stone-500 mb-4">This won't affect existing tasks already added to projects.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="btn-danger flex-1 justify-center"
              >Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateRow({
  template,
  isAdmin,
  onEdit,
  onDelete,
}: {
  template: TaskTemplate
  isAdmin: boolean
  onEdit: (t: TaskTemplate) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-stone-900">{template.name}</span>
        <div className="flex items-center gap-2 mt-0.5">
          {template.isBillable ? (
            <span className="text-xs text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">Billable</span>
          ) : (
            <span className="text-xs text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">Non-billable</span>
          )}
          {template.isDefault && (
            <span className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Default</span>
          )}
        </div>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(template)} className="btn-ghost px-2 py-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={() => onDelete(template.id)} className="btn-ghost px-2 py-1 text-red-500 hover:text-red-700 hover:bg-red-50">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
