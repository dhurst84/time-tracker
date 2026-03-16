import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from './store/authStore'
import { useTimerStore } from './store/timerStore'
import api from './lib/api'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import TodayPage from './pages/TodayPage'
import ClientsPage from './pages/ClientsPage'
import ClientDetailPage from './pages/ClientDetailPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import AccountPage from './pages/AccountPage'
import ClientGroupsPage from './pages/ClientGroupsPage'
import TasksPage from './pages/TasksPage'
import TeamPage from './pages/TeamPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppInit() {
  const token = useAuthStore((s) => s.token)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setRunningEntry = useTimerStore((s) => s.setRunningEntry)

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then(r => r.data),
    enabled: !!token,
    retry: false,
  })

  const timerQuery = useQuery({
    queryKey: ['running-timer'],
    queryFn: () => api.get('/time-entries/running').then(r => r.data),
    enabled: !!token,
    refetchInterval: false,
  })

  useEffect(() => {
    if (meQuery.isError) clearAuth()
  }, [meQuery.isError, clearAuth])

  useEffect(() => {
    if (timerQuery.data !== undefined) setRunningEntry(timerQuery.data)
  }, [timerQuery.data, setRunningEntry])

  return null
}

export default function App() {
  return (
    <>
      <AppInit />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="client-groups" element={<ClientGroupsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Routes>
    </>
  )
}
