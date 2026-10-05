import { invalidateAfterWrite } from './queryCache'

// Local: web/.env sets VITE_API_BASE=http://127.0.0.1:8787
// Production: always same-origin (never ship localhost into the bundle)
const rawBase = String(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
const API_BASE =
  import.meta.env.PROD && /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawBase)
    ? ''
    : rawBase

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
  const data = await api('/api/expense', { method: 'POST', body: JSON.stringify(payload) })
  const categories = {}
  Object.entries(payload.categories || {}).forEach(([k, v]) => {
    const n = Number(v)
    if (Number.isFinite(n) && n !== 0) categories[k] = n
  })
  invalidateAfterWrite({
    type: 'expense',
    date: payload.date,
    entryPatch: {
      found: true,
      type: 'expense',
      date: payload.date,
      row: data.row,
      count: 1,
      total: data.total,
      categories,
      note: payload.note || '',
    },
  })
  return data
}

export async function addIncome(payload) {
  const data = await api('/api/income', { method: 'POST', body: JSON.stringify(payload) })
  invalidateAfterWrite({
    type: 'income',
    date: payload.date,
    entryPatch: {
      found: true,
      type: 'income',
      date: payload.date,
      row: data.row,
      count: 1,
      total: data.total,
      you: payload.you,
      partner: payload.partner,
      source: payload.source || '',
    },
  })
  return data
}

export async function addCreditCard(payload) {
  const data = await api('/api/credit', { method: 'POST', body: JSON.stringify(payload) })
  invalidateAfterWrite({
    type: 'credit',
    date: payload.date,
    entryPatch: {
      found: true,
      type: 'credit',
      date: payload.date,
      row: data.row,
      count: 1,
      total: payload.total,
      items: payload.items || '',
    },
  })
  return data
}

export async function polishSheet() {
  return api('/api/sheet/style', { method: 'POST' })
}

export function isConfigured() {
  return true
}
