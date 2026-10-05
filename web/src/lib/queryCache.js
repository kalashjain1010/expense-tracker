/**
 * Kharcha query cache — stale-while-revalidate
 *
 * Why this design:
 * - Apps Script is slow (cold start). Tab switches must not wait on network.
 * - We cannot push from Google Sheets cheaply, so “is there new data?” is
 *   answered by: (1) we just wrote → invalidate, (2) soft TTL expired →
 *   background refresh, (3) user taps Refresh, (4) hard refresh → always API.
 * - Soft TTL: serve cache, skip network if young enough (in-app tab switches).
 * - Hard TTL: drop cache after idle (sessionStorage lives with the tab).
 */

const SOFT_TTL_MS = 90_000 // 90s — treat as fresh, no refetch on tab switch
const HARD_TTL_MS = 5 * 60_000 // 5m — discard
const STORAGE_KEY = 'kharcha-cache-v1'

const memory = new Map()
const inflight = new Map()
const listeners = new Set()

function now() {
  return Date.now()
}

/** Browser reload / hard refresh — never trust session cache; hit API. */
function isHardReload() {
  try {
    const nav = performance.getEntriesByType('navigation')[0]
    return nav?.type === 'reload'
  } catch {
    return false
  }
}

function loadPersisted() {
  try {
    if (isHardReload()) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    Object.entries(parsed).forEach(([key, entry]) => {
      if (entry?.data != null && entry?.fetchedAt) memory.set(key, entry)
    })
  } catch {
    /* ignore corrupt storage */
  }
}

function persist() {
  try {
    const out = {}
    memory.forEach((entry, key) => {
      // Keep summary + entry lookups + month details across in-app navigation
      if (key === 'summary' || key.startsWith('entry:') || key.startsWith('month:')) out[key] = entry
    })
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(out))
  } catch {
    /* quota / private mode */
  }
}

loadPersisted()

export function summaryKey() {
  return 'summary'
}

export function entryKey(type, date) {
  return `entry:${type}:${date}`
}

export function monthDetailKey(month) {
  return `month:${month}`
}

export function peek(key) {
  return memory.get(key) || null
}

/** True while a network fetch for this key is in progress (survives unmount). */
export function hasInflight(key) {
  return Boolean(key) && inflight.has(key)
}

export function ageMs(entry) {
  if (!entry?.fetchedAt) return Infinity
  return now() - entry.fetchedAt
}

export function isFresh(entry, softTtl = SOFT_TTL_MS) {
  if (!entry) return false
  // Empty Home summaries go stale quickly so we refetch after sheet writes
  const data = entry.data
  if (
    data &&
    Array.isArray(data.byMonth) &&
    data.byMonth.length === 0 &&
    !(data.recent || []).length
  ) {
    return ageMs(entry) < 5_000
  }
  // Entry "not found" also refreshes sooner — sheet may have gained a row
  if (data && data.found === false && data.type) {
    return ageMs(entry) < 15_000
  }
  return ageMs(entry) < softTtl
}

export function isUsable(entry, hardTtl = HARD_TTL_MS) {
  return Boolean(entry?.data != null) && ageMs(entry) < hardTtl
}

export function setCache(key, data) {
  const entry = { data, fetchedAt: now() }
  memory.set(key, entry)
  persist()
  listeners.forEach((fn) => fn(key, entry))
  return entry
}

export function invalidate(keyOrPrefix) {
  const toDelete = []
  memory.forEach((_, k) => {
    if (k === keyOrPrefix || k.startsWith(`${keyOrPrefix}:`)) toDelete.push(k)
  })
  toDelete.forEach((k) => memory.delete(k))
  persist()
  listeners.forEach((fn) => fn(keyOrPrefix, null))
}

/** Wipe in-memory + sessionStorage cache (logout). */
export function clearAllCaches() {
  memory.clear()
  inflight.clear()
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn('mutation', null))
}

/** After a write we know the sheet changed — drop summary + month caches, patch that entry. */
export function invalidateAfterWrite({ type, date, entryPatch } = {}) {
  memory.delete(summaryKey())
  const monthKeys = []
  memory.forEach((_, k) => {
    if (k.startsWith('month:')) monthKeys.push(k)
  })
  monthKeys.forEach((k) => memory.delete(k))
  if (type && date) {
    const key = entryKey(type, date)
    if (entryPatch) setCache(key, entryPatch)
    else memory.delete(key)
  }
  persist()
  listeners.forEach((fn) => fn('mutation', null))
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Fetch with SWR semantics.
 * In-flight promises are shared and never cancelled on tab unmount —
 * switching away mid-load keeps the request alive for when you return.
 * @returns {{ data, fromCache, refreshed }}
 */
export async function cachedQuery(key, fetcher, { force = false, softTtl = SOFT_TTL_MS } = {}) {
  const cached = peek(key)

  if (!force && isFresh(cached, softTtl)) {
    return { data: cached.data, fromCache: true, refreshed: false }
  }

  if (inflight.has(key)) {
    const data = await inflight.get(key)
    return { data, fromCache: false, refreshed: true }
  }

  const promise = (async () => {
    const data = await fetcher()
    setCache(key, data)
    return data
  })()

  inflight.set(key, promise)
  // Notify subscribers so remounted screens can show loading immediately
  listeners.forEach((fn) => fn(key, peek(key)))
  try {
    const data = await promise
    return { data, fromCache: false, refreshed: true }
  } finally {
    inflight.delete(key)
    listeners.forEach((fn) => fn(key, peek(key)))
  }
}

/** Fire-and-forget warm of a key (joins existing inflight / fresh cache). */
export function prefetch(key, fetcher, opts) {
  if (!key) return Promise.resolve(null)
  return cachedQuery(key, fetcher, opts).catch(() => null)
}

export const CACHE_SOFT_TTL_MS = SOFT_TTL_MS
export const CACHE_HARD_TTL_MS = HARD_TTL_MS
