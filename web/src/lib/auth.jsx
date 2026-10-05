import { createContext, useContext, useEffect, useState } from 'react'
import { fetchMe, loginUrl, logout as apiLogout, polishSheet } from '../lib/api'

const AuthContext = createContext({
  user: null,
  loading: true,
  login: () => {},
  logout: async () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const data = await fetchMe()
      setUser(data.user || null)
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
    window.location.href = loginUrl()
  }

  async function logout() {
    try {
      await apiLogout()
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem('expense_sheet_styled_v2')
    sessionStorage.removeItem('kharcha_sheet_styled')
    setUser(null)
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
