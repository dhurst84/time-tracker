import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  name: string
  email: string
  role: string
  avatarColor: string
  defaultTask?: string
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token })
      },
      clearAuth: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null })
      },
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
    }),
    { name: 'auth-store' }
  )
)
