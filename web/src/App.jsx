import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AppShell from './components/AppShell'
import LockScreen from './components/LockScreen'
import PinSetup from './components/PinSetup'
import CreditPage from './pages/CreditPage'
import Dashboard from './pages/Dashboard'
import ExpensePage from './pages/ExpensePage'
import IncomePage from './pages/IncomePage'
import LoginPage from './pages/LoginPage'
import { AuthProvider, useAuth } from './lib/auth'
import { didSkipPinSetup, isUnlocked } from './lib/pinLock'

function Guard({ children }) {
  const { user, loading, refresh } = useAuth()
  const [gate, setGate] = useState('loading') // loading | setup | lock | open

  useEffect(() => {
    if (loading) {
      setGate('loading')
      return
    }
    if (!user) {
      setGate('open')
      return
    }
    if (user.hasPin) {
      setGate(isUnlocked(user.id) ? 'open' : 'lock')
      return
    }
    if (didSkipPinSetup(user.id)) {
      setGate('open')
      return
    }
    setGate('setup')
  }, [user, loading])

  useEffect(() => {
    const onLock = () => {
      if (user?.hasPin) setGate('lock')
    }
    window.addEventListener('expense-pin-lock', onLock)
    return () => window.removeEventListener('expense-pin-lock', onLock)
  }, [user?.hasPin])

  if (loading || gate === 'loading') {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <p className="muted">Checking session…</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (gate === 'setup') {
    return (
      <PinSetup
        userId={user.id}
        onDone={async ({ hasPin }) => {
          if (hasPin) await refresh()
          setGate('open')
        }}
      />
    )
  }

  if (gate === 'lock') {
    return <LockScreen userId={user.id} onUnlock={() => setGate('open')} />
  }

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
