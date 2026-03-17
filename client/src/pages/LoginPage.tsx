import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('password123')
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const login = useMutation({
    mutationFn: (creds: { email: string; password: string }) =>
      api.post('/auth/login', creds).then(r => r.data),
    onSuccess: (data) => {
      setAuth(data.user, data.token)
      navigate('/today')
    },
    onError: () => toast.error('Invalid credentials'),
  })

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 15" />
              </svg>
            </div>
            <span className="text-xl font-semibold text-stone-900">Harvest Tracker</span>
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-stone-900 mb-6">Sign in</h1>
          <form onSubmit={e => { e.preventDefault(); login.mutate({ email, password }) }} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input" required />
            </div>
            <button type="submit" disabled={login.isPending} className="btn-primary w-full justify-center">
              {login.isPending ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-4 text-xs text-stone-400 text-center">Demo: admin@example.com / password123</p>
        </div>
      </div>
    </div>
  )
}
