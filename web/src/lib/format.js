/** Sheet column names — keep exact keys for Apps Script writes */
export const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Investments',
  'Wants',
  'Travel',
  'needs',
  'Rent & utils',
  'others',
]

/** Friendlier labels in the UI (sheet keys stay unchanged) */
export const CATEGORY_LABELS = {
  Food: 'Food',
  Groceries: 'Groceries',
  Investments: 'Investments',
  Wants: 'Wants',
  Travel: 'Travel',
  needs: 'Needs',
  'Rent & utils': 'Rent & utils',
  others: 'Others',
}

export const ENTRY_TYPE_LABELS = {
  expense: 'Spend',
  income: 'Income',
  credit: 'Card',
}

function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO() {
  return toISO(new Date())
}

export function yesterdayISO() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toISO(d)
}

export function shiftISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return toISO(dt)
}

export function isFutureISO(iso) {
  if (!iso) return false
  return iso > todayISO()
}

/** Never allow picking past today */
export function clampISOToToday(iso) {
  const today = todayISO()
  return iso && iso > today ? today : iso
}

export function formatDisplayDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = todayISO()
  const yest = yesterdayISO()
  const pretty = dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  if (iso === today) return `Today · ${pretty}`
  if (iso === yest) return `Yesterday · ${pretty}`
  return pretty
}

export function formatINR(n) {
  const v = Number(n) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v)
}

export function monthLabelFromKey(key) {
  // key: YYYY-MM
  const [y, m] = key.split('-').map(Number)
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[m - 1]} ${String(y).slice(2)}`
}

/** Every YYYY-MM from `fromKey` through the current month (newest first). */
export function allMonthKeys(fromKey = '2024-07') {
  const now = new Date()
  const endY = now.getFullYear()
  const endM = now.getMonth() + 1
  let [y, m] = String(fromKey)
    .split('-')
    .map(Number)
  if (!y || !m) {
    y = endY
    m = 1
  }
  const keys = []
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return keys.reverse()
}
