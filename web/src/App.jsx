import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import CreditPage from './pages/CreditPage'
import Dashboard from './pages/Dashboard'
import ExpensePage from './pages/ExpensePage'
import IncomePage from './pages/IncomePage'
import LoginPage from './pages/LoginPage'
import { AuthProvider, useAuth } from './lib/auth'

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <p className="muted">Checking session…</p>
        </div>
      </div>
    )
  }
  if (!user) return <LoginPage />
  return children
}

function AppRoutes() {
  return (
    <Guard>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="expense" element={<ExpensePage />} />
            <Route path="income" element={<IncomePage />} />
            <Route path="credit" element={<CreditPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Guard>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
