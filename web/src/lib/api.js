import { isFutureISO } from './format'
import { enqueueWrite, shouldQueueError } from './offlineQueue'
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

function queueOrThrow(kind, payload, err, allowQueue) {
  if (allowQueue && shouldQueueError(err)) {
    enqueueWrite({ kind, payload })
    return true
  }
  return false
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

export async function setPin(pin) {
  return api('/api/pin', { method: 'POST', body: JSON.stringify({ pin }) })
}

export async function verifyPin(pin) {
  return api('/api/pin/verify', { method: 'POST', body: JSON.stringify({ pin }) })
}

export async function clearPin(pin) {
  return api('/api/pin', { method: 'DELETE', body: JSON.stringify({ pin }) })
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

export async function addExpense(payload, { allowQueue = true } = {}) {
  if (isFutureISO(payload.date)) throw new Error('Future dates are not allowed')
  const categories = {}
  Object.entries(payload.categories || {}).forEach(([k, v]) => {
    const n = Number(v)
    if (Number.isFinite(n) && n !== 0) categories[k] = n
  })
  const optimistic = {
    found: true,
    type: 'expense',
    date: payload.date,
    row: 0,
    count: 1,
    total: Object.values(categories).reduce((s, v) => s + (Number(v) || 0), 0),
    categories,
    note: payload.note || '',
  }
  try {
    const data = await api('/api/expense', { method: 'POST', body: JSON.stringify(payload) })
    invalidateAfterWrite({
      type: 'expense',
      date: payload.date,
      entryPatch: {
        ...optimistic,
        row: data.row,
        total: data.total,
      },
    })
    return data
  } catch (err) {
    if (queueOrThrow('expense', payload, err, allowQueue)) {
      invalidateAfterWrite({ type: 'expense', date: payload.date, entryPatch: optimistic })
      return { ...optimistic, queued: true }
    }
    throw err
  }
}

export async function addIncome(payload, { allowQueue = true } = {}) {
  if (isFutureISO(payload.date)) throw new Error('Future dates are not allowed')
  const optimistic = {
    found: true,
    type: 'income',
    date: payload.date,
    row: 0,
    count: 1,
    total: (Number(payload.you) || 0) + (Number(payload.partner) || 0),
    you: payload.you,
    partner: payload.partner,
    source: payload.source || '',
  }
  try {
    const data = await api('/api/income', { method: 'POST', body: JSON.stringify(payload) })
    invalidateAfterWrite({
      type: 'income',
      date: payload.date,
      entryPatch: {
        ...optimistic,
        row: data.row,
        total: data.total,
      },
    })
    return data
  } catch (err) {
    if (queueOrThrow('income', payload, err, allowQueue)) {
      invalidateAfterWrite({ type: 'income', date: payload.date, entryPatch: optimistic })
      return { ...optimistic, queued: true }
    }
    throw err
  }
}

export async function addCreditCard(payload, { allowQueue = true } = {}) {
  if (isFutureISO(payload.date)) throw new Error('Future dates are not allowed')
  const optimistic = {
    found: true,
    type: 'credit',
    date: payload.date,
    row: 0,
    count: 1,
    total: payload.total,
    items: payload.items || '',
  }
  try {
    const data = await api('/api/credit', { method: 'POST', body: JSON.stringify(payload) })
    invalidateAfterWrite({
      type: 'credit',
      date: payload.date,
      entryPatch: {
        ...optimistic,
        row: data.row,
      },
    })
    return data
  } catch (err) {
    if (queueOrThrow('credit', payload, err, allowQueue)) {
      invalidateAfterWrite({ type: 'credit', date: payload.date, entryPatch: optimistic })
      return { ...optimistic, queued: true }
    }
    throw err
  }
}

export async function polishSheet() {
  return api('/api/sheet/style', { method: 'POST' })
}

export function isConfigured() {
  return true
}
