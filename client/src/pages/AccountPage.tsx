import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { avatarInitials } from '../lib/utils'

const COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0ea5e9','#ca8a04','#dc2626','#6366f1','#f59e0b']

export default function AccountPage() {
  const { user, updateUser } = useAuthStore()

  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || COLORS[0])

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const updateProfile = useMutation({
    mutationFn: (data: { name: string; email: string; avatarColor: string }) =>
      api.patch('/users/profile', data).then(r => r.data),
    onSuccess: (data) => {
      updateUser(data)
      toast.success('Profile updated')
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const updatePassword = useMutation({
    mutationFn: (data: { currentPassword: string; password: string }) =>
      api.patch('/users/profile', data).then(r => r.data),
    onSuccess: () => {
      toast.success('Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: () => toast.error('Failed to update password — check your current password'),
  })

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    updateProfile.mutate({ name, email, avatarColor })
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    updatePassword.mutate({ currentPassword, password: newPassword })
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold text-stone-900">My Account</h1>

      {/* Profile */}
      <div className="card p-5">
        <h2 className="font-semibold text-stone-900 mb-4">Profile</h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-semibold flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {user ? avatarInitials(user.name) : '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-stone-700 mb-2">Avatar color</p>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAvatarColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${avatarColor === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" required />
          </div>

          <button type="submit" disabled={updateProfile.isPending} className="btn-primary">
            {updateProfile.isPending ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="card p-5">
        <h2 className="font-semibold text-stone-900 mb-4">Change Password</h2>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <div>
            <label className="label">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={updatePassword.isPending} className="btn-primary">
            {updatePassword.isPending ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
