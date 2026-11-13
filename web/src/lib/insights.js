/** Soft copy helpers — pace, greeting, month deltas. */

export function greetingForNow(date = new Date()) {
  const h = date.getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

export function formatLongDate(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function prevMonthKey(key) {
  const [y, m] = String(key).split('-').map(Number)
  if (!y || !m) return key
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Days elapsed in calendar month (1-based through today if current month). */
export function daysElapsedInMonth(monthKey, now = new Date()) {
  const [y, m] = String(monthKey).split('-').map(Number)
  const thisKey = currentMonthKey(now)
  if (monthKey === thisKey) return Math.max(1, now.getDate())
  return new Date(y, m, 0).getDate()
}

export function daysInMonth(monthKey) {
  const [y, m] = String(monthKey).split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/**
 * Pace projection for current-month spend.
 * @returns {{ pace: number, compareLabel: string } | null}
 */
export function spendPaceInsight(mtdSpend, lastMonthSpend, now = new Date()) {
  const key = currentMonthKey(now)
  const elapsed = daysElapsedInMonth(key, now)
  const totalDays = daysInMonth(key)
  if (!mtdSpend || elapsed < 1) return null
  const pace = Math.round((mtdSpend / elapsed) * totalDays)
  let compareLabel = ''
  if (lastMonthSpend > 0) {
    const diff = pace - lastMonthSpend
    const pct = Math.round((Math.abs(diff) / lastMonthSpend) * 100)
    if (pct >= 3) {
      compareLabel =
        diff > 0
          ? `About ${pct}% above last month’s ${formatSoft(lastMonthSpend)}.`
          : `About ${pct}% under last month’s ${formatSoft(lastMonthSpend)}.`
    } else {
      compareLabel = `Near last month’s ${formatSoft(lastMonthSpend)}.`
    }
  }
  return { pace, compareLabel, elapsed, totalDays }
}

function formatSoft(n) {
  const v = Number(n) || 0
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`
  return `₹${Math.round(v)}`
}

export function deltaPct(current, previous) {
  const a = Number(current) || 0
  const b = Number(previous) || 0
  if (b <= 0) return a > 0 ? 100 : 0
  return Math.round(((a - b) / b) * 100)
}

export function monthField(row, kind) {
  if (!row) return 0
  if (kind === 'expense') return Number(row.spend) || 0
  if (kind === 'income') return Number(row.income) || 0
  if (kind === 'credit') return Number(row.credit) || 0
  return 0
}
