const API_BASE = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8787').replace(/\/$/, '')

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })
  const json = await res.json().catch(() => ({ ok: false, error: 'Bad response from API' }))
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json.data
}

export function loginUrl() {
  return `${API_BASE}/auth/google`
}

export async function fetchMe() {
  return api('/api/me')
}

export async function logout() {
  return api('/auth/logout', { method: 'POST' })
}

export async function fetchSummary() {
  return api('/api/summary')
}

export async function fetchMonthDetail(month) {
  return api(`/api/month?month=${encodeURIComponent(month)}`)
}

export async function fetchEntry(type, date) {
  return api(`/api/entry?type=${encodeURIComponent(type)}&date=${encodeURIComponent(date)}`)
}

export async function addExpense(payload) {
  return api('/api/expense', { method: 'POST', body: JSON.stringify(payload) })
}

export async function addIncome(payload) {
  return api('/api/income', { method: 'POST', body: JSON.stringify(payload) })
}

export async function addCreditCard(payload) {
  return api('/api/credit', { method: 'POST', body: JSON.stringify(payload) })
}

export function isConfigured() {
  return true
}
