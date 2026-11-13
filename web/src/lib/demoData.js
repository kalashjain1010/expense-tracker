/** DEV-only demo payloads. Gated by callers with import.meta.env.DEV. */

import { EXPENSE_CATEGORIES, todayISO, shiftISO } from './format'
import { currentMonthKey, prevMonthKey } from './insights'

function pad(n) {
  return String(n).padStart(2, '0')
}

function isoInMonth(monthKey, day) {
  const [y, m] = monthKey.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const d = Math.min(Math.max(1, day), last)
  return `${y}-${pad(m)}-${pad(d)}`
}

function monthRow(month, spend, income, credit) {
  return { month, spend, income, credit }
}

/** Rich summary so Home / chips / charts render non-zero numbers. */
export function demoSummary() {
  const thisKey = currentMonthKey()
  const lastKey = prevMonthKey(thisKey)
  const prev2 = prevMonthKey(lastKey)
  const prev3 = prevMonthKey(prev2)
  const today = todayISO()
  const yest = shiftISO(today, -1)
  const d3 = shiftISO(today, -3)

  const mtdSpend = 42850
  const mtdIncome = 95000
  const mtdCredit = 12400

  return {
    demo: true,
    mtd: {
      spend: mtdSpend,
      income: mtdIncome,
      credit: mtdCredit,
      creditOutstanding: 18750,
      net: mtdIncome - mtdSpend,
    },
    creditOutstanding: 18750,
    byMonth: [
      monthRow(prev3, 38200, 90000, 9800),
      monthRow(prev2, 41500, 92000, 11200),
      monthRow(lastKey, 39120, 90000, 10500),
      monthRow(thisKey, mtdSpend, mtdIncome, mtdCredit),
    ],
    topCategoriesMtd: [
      { name: 'Groceries', value: 12400 },
      { name: 'Food', value: 9800 },
      { name: 'Rent & utils', value: 8500 },
      { name: 'Travel', value: 5200 },
      { name: 'Wants', value: 4100 },
      { name: 'needs', value: 1850 },
    ],
    topCategoriesAll: [
      { name: 'Groceries', value: 48200 },
      { name: 'Food', value: 36100 },
      { name: 'Rent & utils', value: 34000 },
      { name: 'Travel', value: 18900 },
      { name: 'Wants', value: 15200 },
      { name: 'Investments', value: 12000 },
      { name: 'needs', value: 7400 },
      { name: 'others', value: 3100 },
    ],
    recent: [
      { type: 'expense', date: today, total: 1840, note: 'Lunch + metro' },
      { type: 'credit', date: today, total: 3200, note: 'Amazon order' },
      { type: 'income', date: yest, total: 95000, note: 'Salary' },
      { type: 'expense', date: yest, total: 6200, note: 'Weekly groceries' },
      { type: 'expense', date: d3, total: 2100, note: 'Dinner out' },
      { type: 'credit', date: d3, total: 4500, note: 'Flight seats' },
    ],
    categories: EXPENSE_CATEGORIES,
    generatedAt: new Date().toISOString(),
  }
}

/** Day-by-day month detail for TabMonthView / MonthDetail. */
export function demoMonthDetail(month) {
  const thisKey = currentMonthKey()
  const key = month || thisKey
  const scale = key === thisKey ? 1 : key === prevMonthKey(thisKey) ? 0.9 : 0.85

  const days = [
    {
      date: isoInMonth(key, 2),
      spend: Math.round(6200 * scale),
      income: 0,
      credit: 0,
      categories: [
        { name: 'Groceries', value: Math.round(4200 * scale) },
        { name: 'Food', value: Math.round(2000 * scale) },
      ],
      note: 'Weekly groceries',
      incomeNote: '',
      creditNote: '',
    },
    {
      date: isoInMonth(key, 5),
      spend: Math.round(1850 * scale),
      income: 0,
      credit: Math.round(3200 * scale),
      categories: [
        { name: 'Food', value: Math.round(1200 * scale) },
        { name: 'Travel', value: Math.round(650 * scale) },
      ],
      note: 'Lunch + metro',
      incomeNote: '',
      creditNote: 'Amazon order',
    },
    {
      date: isoInMonth(key, 8),
      spend: Math.round(8500 * scale),
      income: Math.round(95000 * scale),
      credit: 0,
      categories: [{ name: 'Rent & utils', value: Math.round(8500 * scale) }],
      note: 'Rent',
      incomeNote: 'Salary',
      creditNote: '',
    },
    {
      date: isoInMonth(key, 12),
      spend: Math.round(4100 * scale),
      income: 0,
      credit: Math.round(4500 * scale),
      categories: [
        { name: 'Wants', value: Math.round(2500 * scale) },
        { name: 'Food', value: Math.round(1600 * scale) },
      ],
      note: 'Weekend',
      incomeNote: '',
      creditNote: 'Flight seats',
    },
    {
      date: isoInMonth(key, 18),
      spend: Math.round(5200 * scale),
      income: 0,
      credit: Math.round(2800 * scale),
      categories: [
        { name: 'Travel', value: Math.round(3200 * scale) },
        { name: 'needs', value: Math.round(2000 * scale) },
      ],
      note: 'Cab + pharmacy',
      incomeNote: '',
      creditNote: 'Electronics',
    },
    {
      date: isoInMonth(key, 22),
      spend: Math.round(9800 * scale),
      income: 0,
      credit: Math.round(1900 * scale),
      categories: [
        { name: 'Groceries', value: Math.round(5400 * scale) },
        { name: 'Food', value: Math.round(2800 * scale) },
        { name: 'others', value: Math.round(1600 * scale) },
      ],
      note: 'Big shop',
      incomeNote: '',
      creditNote: 'Subscriptions',
    },
  ].sort((a, b) => b.date.localeCompare(a.date))

  const totals = days.reduce(
    (acc, d) => {
      acc.spend += d.spend
      acc.income += d.income
      acc.credit += d.credit
      return acc
    },
    { spend: 0, income: 0, credit: 0 },
  )
  totals.net = totals.income - totals.spend

  const catMap = {}
  days.forEach((d) => {
    ;(d.categories || []).forEach((c) => {
      catMap[c.name] = (catMap[c.name] || 0) + c.value
    })
  })

  return {
    demo: true,
    month: key,
    totals,
    categories: Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    days,
    generatedAt: new Date().toISOString(),
  }
}

export function demoEntry(type, date) {
  const iso = date || todayISO()
  const day = Number(iso.slice(-2)) || 1

  if (type === 'expense') {
    // Seed a few dates so day-edit forms show existing values
    if (day % 5 === 0 || day % 5 === 2) {
      const categories = {
        Food: 420,
        Groceries: day % 5 === 0 ? 1800 : 0,
        Travel: day % 5 === 2 ? 350 : 0,
      }
      Object.keys(categories).forEach((k) => {
        if (!categories[k]) delete categories[k]
      })
      const total = Object.values(categories).reduce((s, v) => s + v, 0)
      return {
        demo: true,
        found: true,
        type: 'expense',
        date: iso,
        row: 2,
        count: 1,
        total,
        categories,
        note: day % 5 === 0 ? 'Weekly groceries' : 'Lunch + metro',
      }
    }
    return { demo: true, found: false, type: 'expense', date: iso, count: 0 }
  }

  if (type === 'income') {
    if (day <= 8) {
      return {
        demo: true,
        found: true,
        type: 'income',
        date: iso,
        row: 2,
        count: 1,
        you: 70000,
        partner: 25000,
        kalash: 70000,
        mummy: 25000,
        total: 95000,
        source: 'Salary',
      }
    }
    return { demo: true, found: false, type: 'income', date: iso, count: 0 }
  }

  if (day % 4 === 1) {
    return {
      demo: true,
      found: true,
      type: 'credit',
      date: iso,
      row: 2,
      count: 1,
      total: 3200,
      items: 'Amazon order',
    }
  }
  return { demo: true, found: false, type: 'credit', date: iso, count: 0 }
}

export const DEMO_USER = {
  id: 'demo',
  email: 'demo@local',
  name: 'Demo',
  hasPin: false,
  spreadsheetUrl: null,
}
