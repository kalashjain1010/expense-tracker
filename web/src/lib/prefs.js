import { EXPENSE_CATEGORIES } from './format'

const BUDGET_KEY = 'kharcha_month_budget_v1'
const NOTES_KEY = 'kharcha_recent_notes_v1'
const PINS_KEY = 'kharcha_pinned_cats_v1'
const LAST_CAT_KEY = 'kharcha_last_cat_v1'
const LAYOUT_KEY = 'kharcha_layout_mode_v1'
const MAX_NOTES = 8

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode / full storage */
  }
}

export function getMonthBudget() {
  const n = Number(readJson(BUDGET_KEY, 0))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

export function setMonthBudget(value) {
  const n = Math.max(0, Math.round(Number(value) || 0))
  writeJson(BUDGET_KEY, n)
  return n
}

export function getRecentNotes() {
  const list = readJson(NOTES_KEY, [])
  return Array.isArray(list) ? list.filter((x) => typeof x === 'string' && x.trim()) : []
}

export function rememberNote(note) {
  const text = String(note || '').trim()
  if (!text) return getRecentNotes()
  const prev = getRecentNotes().filter((n) => n.toLowerCase() !== text.toLowerCase())
  const next = [text, ...prev].slice(0, MAX_NOTES)
  writeJson(NOTES_KEY, next)
  return next
}

export function getPinnedCategories() {
  const list = readJson(PINS_KEY, [])
  if (!Array.isArray(list)) return []
  return list.filter((c) => EXPENSE_CATEGORIES.includes(c))
}

export function togglePinnedCategory(category) {
  if (!EXPENSE_CATEGORIES.includes(category)) return getPinnedCategories()
  const cur = getPinnedCategories()
  const next = cur.includes(category) ? cur.filter((c) => c !== category) : [...cur, category]
  writeJson(PINS_KEY, next)
  return next
}

export function getLastUsedCategory() {
  const c = readJson(LAST_CAT_KEY, '')
  return EXPENSE_CATEGORIES.includes(c) ? c : ''
}

export function setLastUsedCategory(category) {
  if (!EXPENSE_CATEGORIES.includes(category)) return
  writeJson(LAST_CAT_KEY, category)
}

/** Pinned first (★), then default sheet order. No recent-to-top. */
export function orderedCategories() {
  const pins = getPinnedCategories()
  const rest = EXPENSE_CATEGORIES.filter((c) => !pins.includes(c))
  return [...pins, ...rest]
}

/** Desktop shell preference when the window is wide enough. Defaults to desktop. */
export function getLayoutMode() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (raw == null) return 'desktop'
    const v = JSON.parse(raw)
    return v === 'mobile' ? 'mobile' : 'desktop'
  } catch {
    return 'desktop'
  }
}

export function setLayoutMode(mode) {
  const next = mode === 'mobile' ? 'mobile' : 'desktop'
  writeJson(LAYOUT_KEY, next)
  return next
}
