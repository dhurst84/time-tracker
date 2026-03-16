import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { avatarInitials } from '../lib/utils'

interface User {
  id: string; name: string; email: string; role: string; avatarColor: string
}

const COLORS = ['#0d9488','#7c3aed','#db2777','#ea580c','#16a34a','#0ea5e9','#ca8a04','#dc2626','#6366f1','#f59e0b']

export default function SettingsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  // New user form
  const [showNewUser, setShowNewUser] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('member')
  const [newColor, setNewColor] = useState(COLORS[0])

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  })

  const createUser = useMutation({
    mutationFn: (data: { name: string; email: string; password: string; role: string; avatarColor: string }) =>
      api.post('/users', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowNewUser(false)
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('member')
      toast.success('User created')
    },
    onError: () => toast.error('Failed to create user'),
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated') },
    onError: () => toast.error('Failed to deactivate user'),
  })

  function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    createUser.mutate({ name: newName, email: newEmail, password: newPassword, role: newRole, avatarColor: newColor })
  }

  if (user?.role !== 'admin') return <Navigate to="/account" replace />

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-stone-900 mb-6">Settings</h1>

      {/* Team members (admin only) */}
      {user?.role === 'admin' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-900">Team Members</h2>
            <button onClick={() => setShowNewUser(true)} className="btn-secondary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add member
            </button>
          </div>

          {showNewUser && (
            <div className="bg-stone-50 rounded-xl p-4 mb-4 border border-stone-200">
              <h3 className="font-medium text-stone-900 mb-3">New Team Member</h3>
              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Name *</label>
                    <input value={newName} onChange={e => setNewName(e.target.value)} className="input" required />
                  </div>
                  <div>
                    <label className="label">Email *</label>
                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="input" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Password *</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input" required />
                  </div>
                  <div>
                    <label className="label">Role</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className="input">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => (
                      <button key={c} type="button" onClick={() => setNewColor(c)}
                        className={`w-7 h-7 rounded-full ${newColor === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowNewUser(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={createUser.isPending} className="btn-primary">Create</button>
                </div>
              </form>
            </div>
          )}

          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-stone-50">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                  style={{ backgroundColor: u.avatarColor }}
                >
                  {avatarInitials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900">{u.name}</p>
                  <p className="text-xs text-stone-500">{u.email} · {u.role}</p>
                </div>
                {u.id !== user?.id && (
                  <button
                    onClick={() => { if (confirm(`Deactivate ${u.name}? Their time history will be preserved.`)) deleteUser.mutate(u.id) }}
                    className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
