import { google } from 'googleapis'

export const SHEET_EXPENSE = 'daily Kharcha'
export const SHEET_INCOME = 'Income'
export const SHEET_CC = 'Credit card spends'

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

export const EXPENSE_HEADERS = [
  'Date',
  'Total Amount',
  ...EXPENSE_CATEGORIES,
  'Note',
]

export const INCOME_HEADERS = ['Date', 'Kalash', 'Mummy', 'Total', 'Source']
export const CC_HEADERS = ['Date', 'Total', 'Items']

function sheetsApi(auth) {
  return google.sheets({ version: 'v4', auth })
}

function driveApi(auth) {
  return google.drive({ version: 'v3', auth })
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(d) {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function parseISODate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function num(v) {
  if (v === '' || v == null) return 0
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v).replace(/[₹,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function blankOrNum(v) {
  const n = num(v)
  return n === 0 ? '' : n
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function coerceDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v
  if (typeof v === 'number') {
    // Sheets serial
    const d = new Date(Math.round((v - 25569) * 86400 * 1000))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
  return null
}

async function readSheetValues(auth, spreadsheetId, sheetName) {
  const sheets = sheetsApi(auth)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'`,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  })
  return res.data.values || []
}

async function writeRow(auth, spreadsheetId, sheetName, rowIndex1Based, values) {
  const sheets = sheetsApi(auth)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A${rowIndex1Based}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}

async function appendRow(auth, spreadsheetId, sheetName, values) {
  const sheets = sheetsApi(auth)
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  })
  const updated = res.data.updates?.updatedRange || ''
  const m = updated.match(/![A-Z]+(\d+)/)
  return m ? Number(m[1]) : null
}

export async function createBlankKharchaSpreadsheet(auth, title = 'Kharcha') {
  const sheets = sheetsApi(auth)
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: SHEET_EXPENSE } },
        { properties: { title: SHEET_INCOME } },
        { properties: { title: SHEET_CC } },
      ],
    },
  })

  const spreadsheetId = created.data.spreadsheetId
  const spreadsheetUrl = created.data.spreadsheetUrl

  // Remove default Sheet1 if present
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const extra = (meta.data.sheets || []).filter(
    (s) => ![SHEET_EXPENSE, SHEET_INCOME, SHEET_CC].includes(s.properties.title),
  )
  if (extra.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: extra.map((s) => ({ deleteSheet: { sheetId: s.properties.sheetId } })),
      },
    })
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `'${SHEET_EXPENSE}'!A1`, values: [EXPENSE_HEADERS] },
        { range: `'${SHEET_INCOME}'!A1`, values: [INCOME_HEADERS] },
        { range: `'${SHEET_CC}'!A1`, values: [CC_HEADERS] },
      ],
    },
  })

  return { spreadsheetId, spreadsheetUrl }
}

export async function copyTemplateSpreadsheet(auth, templateId, title = 'Kharcha') {
  const drive = driveApi(auth)
  const copied = await drive.files.copy({
    fileId: templateId,
    requestBody: { name: title },
    supportsAllDrives: true,
  })
  const spreadsheetId = copied.data.id
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  return { spreadsheetId, spreadsheetUrl }
}

export async function ensureUserSpreadsheet(auth, user) {
  if (user?.spreadsheet_id) {
    return {
      spreadsheetId: user.spreadsheet_id,
      spreadsheetUrl: user.spreadsheet_url || `https://docs.google.com/spreadsheets/d/${user.spreadsheet_id}/edit`,
    }
  }
  const templateId = process.env.TEMPLATE_SPREADSHEET_ID
  if (templateId) {
    return copyTemplateSpreadsheet(auth, templateId)
  }
  return createBlankKharchaSpreadsheet(auth)
}

function findLastRowForDate(rows, dateObj) {
  let count = 0
  let last = 0
  for (let i = 1; i < rows.length; i++) {
    const d = coerceDate(rows[i][0])
    if (d && sameDay(d, dateObj)) {
      count++
      last = i + 1 // 1-based
    }
  }
  return { row: last, count }
}

export async function getEntry(auth, spreadsheetId, type, dateIso) {
  const dateObj = parseISODate(dateIso)
  if (type === 'expense') {
    const rows = await readSheetValues(auth, spreadsheetId, SHEET_EXPENSE)
    const found = findLastRowForDate(rows, dateObj)
    if (!found.row) return { found: false, type, date: dateIso, count: 0 }
    const r = rows[found.row - 1]
    const categories = {}
    EXPENSE_CATEGORIES.forEach((name, i) => {
      const v = num(r[i + 2])
      if (v) categories[name] = v
    })
    return {
      found: true,
      type,
      date: dateIso,
      row: found.row,
      count: found.count,
      total: num(r[1]),
      categories,
      note: r[10] || '',
    }
  }
  if (type === 'income') {
    const rows = await readSheetValues(auth, spreadsheetId, SHEET_INCOME)
    const found = findLastRowForDate(rows, dateObj)
    if (!found.row) return { found: false, type, date: dateIso, count: 0 }
    const r = rows[found.row - 1]
    return {
      found: true,
      type,
      date: dateIso,
      row: found.row,
      count: found.count,
      kalash: num(r[1]),
      mummy: num(r[2]),
      total: num(r[3]),
      source: r[4] || '',
    }
  }
  const rows = await readSheetValues(auth, spreadsheetId, SHEET_CC)
  const found = findLastRowForDate(rows, dateObj)
  if (!found.row) return { found: false, type, date: dateIso, count: 0 }
  const r = rows[found.row - 1]
  return {
    found: true,
    type,
    date: dateIso,
    row: found.row,
    count: found.count,
    total: num(r[1]),
    items: r[2] || '',
  }
}

export async function addExpense(auth, spreadsheetId, payload) {
  const dateObj = parseISODate(payload.date)
  if (toISODate(dateObj) > toISODate(new Date())) throw new Error('Future dates are not allowed')
  const cats = payload.categories || {}
  const total = EXPENSE_CATEGORIES.reduce((s, k) => s + num(cats[k]), 0)
  const values = [
    payload.date,
    total || '',
    ...EXPENSE_CATEGORIES.map((k) => blankOrNum(cats[k])),
    payload.note || '',
  ]
  const rows = await readSheetValues(auth, spreadsheetId, SHEET_EXPENSE)
  const found = findLastRowForDate(rows, dateObj)
  let row
  if (found.row) {
    await writeRow(auth, spreadsheetId, SHEET_EXPENSE, found.row, values)
    row = found.row
  } else {
    row = await appendRow(auth, spreadsheetId, SHEET_EXPENSE, values)
  }
  return { row, total, updated: Boolean(found.row) }
}

export async function addIncome(auth, spreadsheetId, payload) {
  const dateObj = parseISODate(payload.date)
  if (toISODate(dateObj) > toISODate(new Date())) throw new Error('Future dates are not allowed')
  const kalash = num(payload.kalash)
  const mummy = num(payload.mummy)
  const total = kalash + mummy
  const values = [payload.date, blankOrNum(kalash), blankOrNum(mummy), total || '', payload.source || '']
  const rows = await readSheetValues(auth, spreadsheetId, SHEET_INCOME)
  const found = findLastRowForDate(rows, dateObj)
  let row
  if (found.row) {
    await writeRow(auth, spreadsheetId, SHEET_INCOME, found.row, values)
    row = found.row
  } else {
    row = await appendRow(auth, spreadsheetId, SHEET_INCOME, values)
  }
  return { row, total, updated: Boolean(found.row) }
}

export async function addCreditCard(auth, spreadsheetId, payload) {
  const dateObj = parseISODate(payload.date)
  if (toISODate(dateObj) > toISODate(new Date())) throw new Error('Future dates are not allowed')
  const total = num(payload.total)
  const values = [payload.date, blankOrNum(total), payload.items || '']
  const rows = await readSheetValues(auth, spreadsheetId, SHEET_CC)
  const found = findLastRowForDate(rows, dateObj)
  let row
  if (found.row) {
    await writeRow(auth, spreadsheetId, SHEET_CC, found.row, values)
    row = found.row
  } else {
    row = await appendRow(auth, spreadsheetId, SHEET_CC, values)
  }
  return { row, total, updated: Boolean(found.row) }
}

export async function buildSummary(auth, spreadsheetId) {
  const [expenseRows, incomeRows, ccRows] = await Promise.all([
    readSheetValues(auth, spreadsheetId, SHEET_EXPENSE),
    readSheetValues(auth, spreadsheetId, SHEET_INCOME),
    readSheetValues(auth, spreadsheetId, SHEET_CC),
  ])

  const byMonth = {}
  const catAll = {}
  const catMtd = {}
  const now = new Date()
  const thisKey = monthKey(now)
  const recent = []

  for (let i = 1; i < expenseRows.length; i++) {
    const r = expenseRows[i]
    const d = coerceDate(r[0])
    if (!d) continue
    const key = monthKey(d)
    byMonth[key] ||= { month: key, spend: 0, income: 0, credit: 0 }
    const spend = num(r[1]) || EXPENSE_CATEGORIES.reduce((s, name, idx) => s + num(r[idx + 2]), 0)
    byMonth[key].spend += spend
    EXPENSE_CATEGORIES.forEach((name, idx) => {
      const v = num(r[idx + 2])
      if (!v) return
      catAll[name] = (catAll[name] || 0) + v
      if (key === thisKey) catMtd[name] = (catMtd[name] || 0) + v
    })
    recent.push({ type: 'expense', date: toISODate(d), total: spend, note: r[10] || '' })
  }

  for (let i = 1; i < incomeRows.length; i++) {
    const r = incomeRows[i]
    const d = coerceDate(r[0])
    if (!d) continue
    const key = monthKey(d)
    byMonth[key] ||= { month: key, spend: 0, income: 0, credit: 0 }
    const total = num(r[3]) || num(r[1]) + num(r[2])
    byMonth[key].income += total
    recent.push({ type: 'income', date: toISODate(d), total, note: r[4] || '' })
  }

  for (let i = 1; i < ccRows.length; i++) {
    const r = ccRows[i]
    const d = coerceDate(r[0])
    if (!d) continue
    const key = monthKey(d)
    byMonth[key] ||= { month: key, spend: 0, income: 0, credit: 0 }
    const total = num(r[1])
    byMonth[key].credit += total
    recent.push({ type: 'credit', date: toISODate(d), total, note: r[2] || '' })
  }

  const months = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))
  const mtd = byMonth[thisKey] || { spend: 0, income: 0, credit: 0 }
  const top = (obj) =>
    Object.entries(obj)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

  recent.sort((a, b) => b.date.localeCompare(a.date))

  return {
    mtd: {
      spend: mtd.spend,
      income: mtd.income,
      credit: mtd.credit,
      net: mtd.income - mtd.spend,
    },
    byMonth: months,
    topCategoriesMtd: top(catMtd),
    topCategoriesAll: top(catAll),
    recent: recent.slice(0, 12),
    categories: EXPENSE_CATEGORIES,
    generatedAt: new Date().toISOString(),
  }
}

export async function getMonthDetail(auth, spreadsheetId, month) {
  const [expenseRows, incomeRows, ccRows] = await Promise.all([
    readSheetValues(auth, spreadsheetId, SHEET_EXPENSE),
    readSheetValues(auth, spreadsheetId, SHEET_INCOME),
    readSheetValues(auth, spreadsheetId, SHEET_CC),
  ])

  const dayMap = {}
  const cats = {}

  const ensure = (iso) => {
    dayMap[iso] ||= {
      date: iso,
      spend: 0,
      income: 0,
      credit: 0,
      categories: [],
      note: '',
      incomeNote: '',
      creditNote: '',
    }
  }

  for (let i = 1; i < expenseRows.length; i++) {
    const r = expenseRows[i]
    const d = coerceDate(r[0])
    if (!d || monthKey(d) !== month) continue
    const iso = toISODate(d)
    ensure(iso)
    const spend = num(r[1]) || EXPENSE_CATEGORIES.reduce((s, name, idx) => s + num(r[idx + 2]), 0)
    dayMap[iso].spend += spend
    dayMap[iso].note = r[10] || dayMap[iso].note
    const dayCats = []
    EXPENSE_CATEGORIES.forEach((name, idx) => {
      const v = num(r[idx + 2])
      if (!v) return
      cats[name] = (cats[name] || 0) + v
      dayCats.push({ name, value: v })
    })
    dayMap[iso].categories = dayCats
  }

  for (let i = 1; i < incomeRows.length; i++) {
    const r = incomeRows[i]
    const d = coerceDate(r[0])
    if (!d || monthKey(d) !== month) continue
    const iso = toISODate(d)
    ensure(iso)
    dayMap[iso].income += num(r[3]) || num(r[1]) + num(r[2])
    dayMap[iso].incomeNote = r[4] || ''
  }

  for (let i = 1; i < ccRows.length; i++) {
    const r = ccRows[i]
    const d = coerceDate(r[0])
    if (!d || monthKey(d) !== month) continue
    const iso = toISODate(d)
    ensure(iso)
    dayMap[iso].credit += num(r[1])
    dayMap[iso].creditNote = r[2] || ''
  }

  const days = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date))
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

  return {
    month,
    totals,
    categories: Object.entries(cats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    days,
    generatedAt: new Date().toISOString(),
  }
}
