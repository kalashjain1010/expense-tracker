import { createContext, useContext, useEffect, useState } from 'react'
import { fetchMe, loginUrl, logout as apiLogout, polishSheet } from './api'
import { DEMO_USER } from './demoData'
import { cachePinUser, clearPinSession } from './pinLock'
import { clearAllCaches } from './queryCache'

const AuthContext = createContext({
  user: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  refresh: async () => {},
})

const DEMO_UI = import.meta.env.DEV && import.meta.env.VITE_DEMO_UI === '1'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (import.meta.env.DEV && import.meta.env.VITE_DEMO_UI === '1') {
      setUser(DEMO_USER)
      cachePinUser(DEMO_USER)
      setLoading(false)
      return
    }
    try {
      const data = await fetchMe()
      setUser(data.user || null)
      if (data.user) cachePinUser(data.user)
      if (data.user?.spreadsheetId && !sessionStorage.getItem('expense_sheet_styled_v2')) {
        polishSheet()
          .then(() => sessionStorage.setItem('expense_sheet_styled_v2', '1'))
          .catch(() => {})
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function login() {
    if (DEMO_UI) {
      setUser(DEMO_USER)
      cachePinUser(DEMO_USER)
      return
    }
    window.location.href = loginUrl()
  }

  async function logout() {
    const uid = user?.id
    if (!DEMO_UI) {
      try {
        await apiLogout()
      } catch {
        /* ignore */
      }
    }
    clearAllCaches()
    if (uid) clearPinSession(uid)
    try {
      const keys = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)
        if (
          k &&
          (k.startsWith('kharcha') ||
            k.startsWith('expense') ||
            k.startsWith('kharcha-') ||
            k === 'expense_sheet_styled_v2')
        ) {
          keys.push(k)
        }
      }
      keys.forEach((k) => sessionStorage.removeItem(k))
      // Also drop the query cache key if naming differs
      sessionStorage.removeItem('kharcha-cache-v1')
    } catch {
      /* ignore */
    }
    setUser(null)
    try {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'logout' }))
    } catch {
      /* ignore */
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
