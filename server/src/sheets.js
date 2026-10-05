import { google } from 'googleapis'

export const SHEET_EXPENSE = 'Spend'
export const SHEET_INCOME = 'Income'
export const SHEET_CC = 'Card'

/** Legacy tab names from earlier builds */
const SHEET_ALIASES = {
  [SHEET_EXPENSE]: ['Spend', 'daily Kharcha'],
  [SHEET_INCOME]: ['Income'],
  [SHEET_CC]: ['Card', 'Credit card spends'],
}

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
  'Food',
  'Groceries',
  'Investments',
  'Wants',
  'Travel',
  'Needs',
  'Rent & utils',
  'Others',
  'Note',
]

export const INCOME_HEADERS = ['Date', 'You', 'Partner', 'Total', 'Source']
export const CC_HEADERS = ['Date', 'Total', 'Items / note']

const HEADER_BG = { red: 0.059, green: 0.318, blue: 0.196 } // #0f5132
const HEADER_FG = { red: 1, green: 1, blue: 1 }
const TAB_COLORS = {
  [SHEET_EXPENSE]: { red: 0.102, green: 0.361, blue: 0.271 },
  [SHEET_INCOME]: { red: 0.18, green: 0.45, blue: 0.35 },
  [SHEET_CC]: { red: 0.55, green: 0.4, blue: 0.2 },
}

/** Bump when column widths / default alignment / banner formulas change — applied once per user. */
export const SHEET_LAYOUT_VERSION = 4

const SHEET_LAYOUT = {
  [SHEET_EXPENSE]: {
    headers: EXPENSE_HEADERS,
    // Date, Total Amount wider; Note very wide
    widths: [200, 150, 95, 105, 115, 95, 95, 95, 115, 95, 720],
    cols: 11,
    noteCol: 10, // 0-based; left-aligned; all others centered
  },
  [SHEET_INCOME]: {
    headers: INCOME_HEADERS,
    widths: [200, 120, 120, 120, 320],
    cols: 5,
    noteCol: 4,
  },
  [SHEET_CC]: {
    headers: CC_HEADERS,
    widths: [200, 150, 720],
    cols: 3,
    noteCol: 2,
  },
}

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

function monthIndexFromName(name) {
  const key = String(name || '')
    .toLowerCase()
    .replace(/\./g, '')
  const names = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ]
  const short = names.map((n) => n.slice(0, 3))
  const i = names.indexOf(key)
  if (i >= 0) return i
  const j = short.indexOf(key.slice(0, 3))
  return j >= 0 ? j : -1
}

function coerceDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate())
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Sheets serial → local calendar date (avoid UTC day-shift)
    const utc = new Date(Math.round((v - 25569) * 86400 * 1000))
    if (Number.isNaN(utc.getTime())) return null
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
  }
  const s = String(v).trim()
  if (!s || s.startsWith('#')) return null
  // Month banners like "October 2026" are labels, not day rows
  if (/^[A-Za-z]+\s+\d{4}$/.test(s)) return null

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))

  // "5 October 2026" / "05 Oct 2026" (Sheets formatted dates)
  const dMonY = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (dMonY) {
    const mi = monthIndexFromName(dMonY[2])
    if (mi >= 0) return new Date(Number(dMonY[3]), mi, Number(dMonY[1]))
  }

  // "October 5, 2026" / "Oct 5 2026"
  const monDY = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monDY) {
    const mi = monthIndexFromName(monDY[1])
    if (mi >= 0) return new Date(Number(monDY[3]), mi, Number(monDY[2]))
  }

  return null
}

async function resolveSheetName(auth, spreadsheetId, preferred) {
  const sheets = sheetsApi(auth)
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })
  const titles = new Set((meta.data.sheets || []).map((s) => s.properties.title))
  const aliases = SHEET_ALIASES[preferred] || [preferred]
  for (const name of aliases) {
    if (titles.has(name)) return name
  }
  return preferred
}

async function readSheetValues(auth, spreadsheetId, preferredName) {
  const sheets = sheetsApi(auth)
  const sheetName = await resolveSheetName(auth, spreadsheetId, preferredName)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'`,
    // SERIAL_NUMBER keeps dates as numbers (FORMATTED_STRING broke Home/prefill parsing)
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  })
  return res.data.values || []
}

async function writeRow(auth, spreadsheetId, preferredName, rowIndex1Based, values) {
  const sheets = sheetsApi(auth)
  const sheetName = await resolveSheetName(auth, spreadsheetId, preferredName)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A${rowIndex1Based}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  })
}

async function appendRow(auth, spreadsheetId, preferredName, values) {
  const sheets = sheetsApi(auth)
  const sheetName = await resolveSheetName(auth, spreadsheetId, preferredName)
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

function monthTotalFormula(year, monthIndex0) {
  const startM = monthIndex0 + 1
  const endY = monthIndex0 === 11 ? year + 1 : year
  const endM = monthIndex0 === 11 ? 1 : monthIndex0 + 2
  // Sum Total Amount (col B) like personal Kharcha — manual B edits update the month header.
  // Banner row has text in A, so date criteria exclude it (no circular #ERROR!).
  return `SUMIFS(B:B,A:A,">="&DATE(${year},${startM},1),A:A,"<"&DATE(${endY},${endM},1))`
}

function isErrorCell(v) {
  return typeof v === 'string' && String(v).trim().startsWith('#')
}

function isBannerLabel(v) {
  if (v == null || v === '') return false
  if (typeof v === 'number') return false
  if (v instanceof Date) return false
  if (isErrorCell(v)) return false
  const s = String(v).trim()
  if (!s || /^\d/.test(s)) return false
  // Real banners look like "October 2026"
  return /^[A-Za-z]+\s+\d{4}$/.test(s) || (/[a-zA-Z]/.test(s) && /\d{4}/.test(s) && !/^\d/.test(s))
}

/** Day-1 date + no category amounts → likely a banner that Sheets turned into a date. */
function isCorruptBannerRow(row) {
  if (isErrorCell(row?.[0]) || isErrorCell(row?.[1])) return true
  const d = coerceDate(row?.[0])
  if (!d || d.getDate() !== 1) return false
  const note = row[10]
  if (note) return false
  for (let c = 2; c <= 9; c++) {
    if (num(row[c]) !== 0) return false
  }
  const b = row[1]
  if (b === '#REF!' || b === '' || b == null || String(b).startsWith('#')) return true
  return num(b) === 0
}

function findMonthBannerRow(rows, year, monthIndex0) {
  const want = monthLabel(new Date(year, monthIndex0, 1)).toLowerCase()
  const monthOnly = want.split(' ')[0]
  for (let i = 1; i < rows.length; i++) {
    const v = rows[i][0]
    if (isBannerLabel(v)) {
      const lower = String(v).toLowerCase().replace(/\s+/g, ' ').trim()
      if (lower.indexOf(monthOnly) === 0 && lower.includes(String(year))) {
        return i + 1
      }
      continue
    }
    const d = coerceDate(v)
    if (d && d.getFullYear() === year && d.getMonth() === monthIndex0 && isCorruptBannerRow(rows[i])) {
      return i + 1
    }
  }
  return 0
}

async function getSheetMeta(auth, spreadsheetId) {
  const sheets = sheetsApi(auth)
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title,gridProperties)',
  })
  return meta.data.sheets || []
}

async function formatDataRow(auth, spreadsheetId, sheetId, row1Based, currencyEndCol, noteCol = 10) {
  const sheets = sheetsApi(auth)
  const r = row1Based - 1
  const black = { red: 0, green: 0, blue: 0 }
  const white = { red: 1, green: 1, blue: 1 }
  const baseText = { fontFamily: 'Arial', fontSize: 10, bold: false, foregroundColor: black }
  const cols = Math.max(noteCol + 1, currencyEndCol, 11)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: cols },
            cell: {
              userEnteredFormat: {
                backgroundColor: white,
                textFormat: baseText,
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 1 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'DATE', pattern: 'd mmmm yyyy' },
                textFormat: baseText,
                backgroundColor: white,
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(numberFormat,textFormat,backgroundColor,horizontalAlignment,verticalAlignment)',
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: r,
              endRowIndex: r + 1,
              startColumnIndex: 1,
              endColumnIndex: currencyEndCol,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'CURRENCY', pattern: '₹#,##0.00' },
                textFormat: baseText,
                backgroundColor: white,
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(numberFormat,textFormat,backgroundColor,horizontalAlignment,verticalAlignment)',
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: r,
              endRowIndex: r + 1,
              startColumnIndex: noteCol,
              endColumnIndex: noteCol + 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: white,
                textFormat: baseText,
                horizontalAlignment: 'LEFT',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
      ],
    },
  })
}

/**
 * Write month banner like personal Kharcha:
 * A = plain text "October 2026" (RAW — never auto-dated)
 * B = live SUMIFS on Total Amount (col B) — manual sheet edits update the header
 */
async function writeBannerRow(auth, spreadsheetId, sheetId, row1Based, year, monthIndex0, sheetName) {
  const sheets = sheetsApi(auth)
  const name = sheetName || (await resolveSheetName(auth, spreadsheetId, SHEET_EXPENSE))
  const label = monthLabel(new Date(year, monthIndex0, 1))
  const formula = `=${monthTotalFormula(year, monthIndex0)}`
  const r = row1Based - 1
  const black = { red: 0, green: 0, blue: 0 }
  const white = { red: 1, green: 1, blue: 1 }

  // RAW keeps "October 2026" as text (USER_ENTERED turns it into a date)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${name}'!A${row1Based}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[label]] },
  })
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${name}'!B${row1Based}:K${row1Based}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[formula, '', '', '', '', '', '', '', '', '']] },
  })

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'ROWS', startIndex: r, endIndex: r + 1 },
            properties: { pixelSize: 30 },
            fields: 'pixelSize',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 11 },
            cell: {
              userEnteredFormat: {
                backgroundColor: white,
                textFormat: {
                  fontFamily: 'Arial',
                  fontSize: 18,
                  bold: true,
                  foregroundColor: black,
                },
                verticalAlignment: 'MIDDLE',
                horizontalAlignment: 'CENTER',
              },
            },
            fields:
              'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 1 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'TEXT', pattern: '@' },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 1, endColumnIndex: 2 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'CURRENCY', pattern: '₹#,##0.00' },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
          },
        },
      ],
    },
  })
}

/**
 * Full Spend-tab rebuild like personal Kharcha:
 * header stays; body becomes [2 blanks][Month YYYY + SUMIFS][day rows…] per month.
 */
async function rebuildSpendLayout(auth, spreadsheetId) {
  const sheets = sheetsApi(auth)
  const sheetName = await resolveSheetName(auth, spreadsheetId, SHEET_EXPENSE)
  const meta = await getSheetMeta(auth, spreadsheetId)
  const sheetId = meta.find((s) => s.properties.title === sheetName)?.properties.sheetId
  if (sheetId == null) return { ok: false }

  const rows = await readSheetValues(auth, spreadsheetId, SHEET_EXPENSE)
  const entries = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (isErrorCell(row[0]) || isErrorCell(row[1])) continue
    if (isBannerLabel(row[0])) continue
    if (isCorruptBannerRow(row)) continue
    const d = coerceDate(row[0])
    if (!d) continue
    const cats = []
    let catSum = 0
    for (let c = 0; c < 8; c++) {
      const amt = num(row[2 + c])
      cats.push(amt === 0 ? '' : amt)
      catSum += amt
    }
    const total = num(row[1]) || catSum
    entries.push({
      date: d,
      total: total === 0 ? '' : total,
      cats,
      note: row[10] || '',
      key: `${d.getFullYear()}-${d.getMonth()}`,
    })
  }
  entries.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Clear body (keep header) — wipe green/white-on-green leftover formats
  const clearTo = Math.max(rows.length + 5, 40)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${sheetName}'!A2:K${clearTo}`,
  })
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1,
              endRowIndex: clearTo,
              startColumnIndex: 0,
              endColumnIndex: 11,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  fontFamily: 'Arial',
                  fontSize: 10,
                  bold: false,
                  foregroundColor: { red: 0, green: 0, blue: 0 },
                },
                backgroundColor: { red: 1, green: 1, blue: 1 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
      ],
    },
  })

  if (!entries.length) {
    // Empty sheet — seed this month's banner after 2 blanks (rows 2–3 empty, banner on 4)
    const now = new Date()
    await writeBannerRow(auth, spreadsheetId, sheetId, 4, now.getFullYear(), now.getMonth(), sheetName)
    return { ok: true, rows: 0, months: 1 }
  }

  const out = []
  const bannerMeta = [] // { outIndex, year, month }
  let prevKey = null
  for (const ent of entries) {
    if (ent.key !== prevKey) {
      out.push(Array(11).fill(''))
      out.push(Array(11).fill(''))
      bannerMeta.push({
        outIndex: out.length,
        year: ent.date.getFullYear(),
        month: ent.date.getMonth(),
      })
      out.push(Array(11).fill('')) // placeholder; written via writeBannerRow
      prevKey = ent.key
    }
    out.push([
      `=DATE(${ent.date.getFullYear()},${ent.date.getMonth() + 1},${ent.date.getDate()})`,
      ent.total,
      ...ent.cats,
      ent.note,
    ])
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A2`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: out },
  })

  // Write real banners (text + formula) and format day rows
  for (const b of bannerMeta) {
    const sheetRow = 2 + b.outIndex
    await writeBannerRow(auth, spreadsheetId, sheetId, sheetRow, b.year, b.month, sheetName)
  }

  const formatReqs = []
  const black = { red: 0, green: 0, blue: 0 }
  const white = { red: 1, green: 1, blue: 1 }
  const dayText = { fontFamily: 'Arial', fontSize: 10, bold: false, foregroundColor: black }
  for (let i = 0; i < out.length; i++) {
    const a = out[i][0]
    if (typeof a === 'string' && a.startsWith('=DATE(')) {
      const r = 1 + i // 0-based row index in sheet (row 2 = index 1)
      formatReqs.push(
        {
          repeatCell: {
            range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 11 },
            cell: {
              userEnteredFormat: {
                backgroundColor: white,
                textFormat: dayText,
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 1 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'DATE', pattern: 'd mmmm yyyy' },
                textFormat: dayText,
                backgroundColor: white,
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(numberFormat,textFormat,backgroundColor,horizontalAlignment,verticalAlignment)',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 1, endColumnIndex: 10 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'CURRENCY', pattern: '₹#,##0.00' },
                textFormat: dayText,
                backgroundColor: white,
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(numberFormat,textFormat,backgroundColor,horizontalAlignment,verticalAlignment)',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 10, endColumnIndex: 11 },
            cell: {
              userEnteredFormat: {
                backgroundColor: white,
                textFormat: dayText,
                horizontalAlignment: 'LEFT',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
      )
    }
  }
  if (formatReqs.length) {
    // batch in chunks of 40
    for (let i = 0; i < formatReqs.length; i += 40) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: formatReqs.slice(i, i + 40) },
      })
    }
  }

  return { ok: true, rows: entries.length, months: bannerMeta.length }
}

async function ensureMonthBanner(auth, spreadsheetId, dateObj) {
  const sheetName = await resolveSheetName(auth, spreadsheetId, SHEET_EXPENSE)
  const rows = await readSheetValues(auth, spreadsheetId, SHEET_EXPENSE)
  const year = dateObj.getFullYear()
  const month = dateObj.getMonth()
  const existing = findMonthBannerRow(rows, year, month)
  if (existing) {
    const meta = await getSheetMeta(auth, spreadsheetId)
    const sheetId = meta.find((s) => s.properties.title === sheetName)?.properties.sheetId
    if (sheetId != null) await writeBannerRow(auth, spreadsheetId, sheetId, existing, year, month, sheetName)
    return existing
  }

  const sheets = sheetsApi(auth)
  const meta = await getSheetMeta(auth, spreadsheetId)
  const sheetId = meta.find((s) => s.properties.title === sheetName)?.properties.sheetId
  const startRow = Math.max(rows.length, 1) + 1
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A${startRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [Array(11).fill(''), Array(11).fill('')] },
  })
  const bannerRow = startRow + 2
  if (sheetId != null) await writeBannerRow(auth, spreadsheetId, sheetId, bannerRow, year, month, sheetName)
  return bannerRow
}

/** Apply header styling to all tabs, then rebuild Spend layout cleanly. */
export async function styleSpreadsheet(auth, spreadsheetId) {
  await applySheetChrome(auth, spreadsheetId)
  await rebuildSpendLayout(auth, spreadsheetId)
  return { ok: true }
}

/**
 * Light layout pass: column widths + center/left alignment.
 * One metadata read + one batchUpdate — safe to run without blowing quota.
 * @param {{ repairBanners?: boolean }} [opts]
 */
export async function applySheetChrome(auth, spreadsheetId, opts = {}) {
  const repairBanners = opts.repairBanners !== false
  const sheets = sheetsApi(auth)
  const metaSheets = await getSheetMeta(auth, spreadsheetId)
  const byTitle = Object.fromEntries(metaSheets.map((s) => [s.properties.title, s.properties.sheetId]))

  const requests = []
  const valueData = []

  for (const preferred of [SHEET_EXPENSE, SHEET_INCOME, SHEET_CC]) {
    const spec = SHEET_LAYOUT[preferred]
    const title =
      (SHEET_ALIASES[preferred] || [preferred]).find((t) => byTitle[t] != null) || preferred
    const sheetId = byTitle[title]
    if (sheetId == null) continue

    valueData.push({ range: `'${title}'!A1`, values: [spec.headers] })

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          title: preferred,
          tabColor: TAB_COLORS[preferred],
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'title,tabColor,gridProperties.frozenRowCount',
      },
    })

    // Header: center all except note/source column (left)
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: spec.cols,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: {
              foregroundColor: HEADER_FG,
              bold: true,
              fontFamily: 'Arial',
              fontSize: 10,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            numberFormat: { type: 'TEXT' },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,numberFormat)',
      },
    })
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: spec.noteCol,
          endColumnIndex: spec.noteCol + 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: {
              foregroundColor: HEADER_FG,
              bold: true,
              fontFamily: 'Arial',
              fontSize: 10,
            },
            horizontalAlignment: 'LEFT',
            verticalAlignment: 'MIDDLE',
            numberFormat: { type: 'TEXT' },
          },
        },
        fields:
          'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,numberFormat)',
      },
    })

    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 28 },
        fields: 'pixelSize',
      },
    })

    spec.widths.forEach((px, i) => {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
          properties: { pixelSize: px },
          fields: 'pixelSize',
        },
      })
    })

    // Body default alignment: center A..(note-1), left note (rows 2–500)
    if (spec.noteCol > 0) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: 500,
            startColumnIndex: 0,
            endColumnIndex: spec.noteCol,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
        },
      })
    }
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 500,
          startColumnIndex: spec.noteCol,
          endColumnIndex: spec.noteCol + 1,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'LEFT',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
      },
    })
  }

  if (valueData.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data: valueData },
    })
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    })
  }

  if (repairBanners) {
    await repairBannerFormulas(auth, spreadsheetId)
  }
  return { ok: true }
}

/**
 * Rewrite every month-banner Total formula to SUMIFS(B:B, …)
 * so editing Total Amount (or adding rows) updates the month header.
 */
async function repairBannerFormulas(auth, spreadsheetId) {
  const sheets = sheetsApi(auth)
  const sheetName = await resolveSheetName(auth, spreadsheetId, SHEET_EXPENSE)
  const meta = await getSheetMeta(auth, spreadsheetId)
  const sheetId = meta.find((s) => s.properties.title === sheetName)?.properties.sheetId
  if (sheetId == null) return { updated: 0 }

  const rows = await readSheetValues(auth, spreadsheetId, SHEET_EXPENSE)
  const valueData = []
  const formatReqs = []
  let updated = 0

  for (let i = 1; i < rows.length; i++) {
    const label = rows[i][0]
    if (!isBannerLabel(label)) continue
    const parts = String(label).trim().split(/\s+/)
    if (parts.length < 2) continue
    const mi = monthIndexFromName(parts[0])
    const year = Number(parts[parts.length - 1])
    if (mi < 0 || !Number.isFinite(year)) continue

    const row1 = i + 1
    const formula = `=${monthTotalFormula(year, mi)}`
    valueData.push({ range: `'${sheetName}'!B${row1}`, values: [[formula]] })
    formatReqs.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: i,
          endRowIndex: i + 1,
          startColumnIndex: 0,
          endColumnIndex: 1,
        },
        cell: { userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    })
    formatReqs.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: i,
          endRowIndex: i + 1,
          startColumnIndex: 1,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: { type: 'CURRENCY', pattern: '₹#,##0.00' },
            textFormat: { fontFamily: 'Arial', fontSize: 18, bold: true },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(numberFormat,textFormat,horizontalAlignment)',
      },
    })
    updated++
  }

  if (valueData.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data: valueData },
    })
  }
  if (formatReqs.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatReqs },
    })
  }
  return { updated }
}

export async function createBlankKharchaSpreadsheet(auth, title = 'Expense Tracker') {
  const sheets = sheetsApi(auth)
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title,
        // Sheets API does not support en_IN; en_GB keeps day-first dates + ₹ formats we set.
        locale: 'en_GB',
        timeZone: 'Asia/Kolkata',
      },
      sheets: [
        { properties: { title: SHEET_EXPENSE, tabColor: TAB_COLORS[SHEET_EXPENSE] } },
        { properties: { title: SHEET_INCOME, tabColor: TAB_COLORS[SHEET_INCOME] } },
        { properties: { title: SHEET_CC, tabColor: TAB_COLORS[SHEET_CC] } },
      ],
    },
  })

  const spreadsheetId = created.data.spreadsheetId
  const spreadsheetUrl = created.data.spreadsheetUrl

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

  // Light first paint (serverless-friendly); full polish can run later via applySheetChrome
  await applySheetChrome(auth, spreadsheetId, { repairBanners: false })
  const sheetName = SHEET_EXPENSE
  const meta2 = await getSheetMeta(auth, spreadsheetId)
  const spendId = meta2.find((s) => s.properties.title === sheetName)?.properties.sheetId
  if (spendId != null) {
    const now = new Date()
    await writeBannerRow(auth, spreadsheetId, spendId, 4, now.getFullYear(), now.getMonth(), sheetName)
  }
  return { spreadsheetId, spreadsheetUrl }
}

export async function copyTemplateSpreadsheet(auth, templateId, title = 'Expense Tracker') {
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

export function isSpreadsheetMissingError(err) {
  const msg = String(err?.message || err || '')
  const code = err?.code || err?.response?.status
  return (
    code === 404 ||
    /Requested entity was not found/i.test(msg) ||
    (/not found/i.test(msg) && /spreadsheet|file|entity/i.test(msg)) ||
    /File not found/i.test(msg)
  )
}

async function spreadsheetStillExists(auth, spreadsheetId) {
  if (!spreadsheetId) return false
  try {
    const sheets = sheetsApi(auth)
    await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'spreadsheetId',
    })
    return true
  } catch (err) {
    if (isSpreadsheetMissingError(err)) return false
    throw err
  }
}

/**
 * Return user's sheet, or create a fresh empty Expense Tracker sheet if missing/deleted.
 * @param {{ polish?: boolean, checkExists?: boolean }} opts
 *   polish — full restyle + rebuild (login / repair only)
 *   checkExists — hit Sheets API to verify file still exists (avoid on every request — quota)
 */
export async function ensureUserSpreadsheet(auth, user, opts = {}) {
  const polish = Boolean(opts.polish)
  // Default: trust DB id; only probe Drive when checkExists:true (deleted-file recovery)
  const checkExists = Boolean(opts.checkExists) && Boolean(user?.spreadsheet_id)

  if (user?.spreadsheet_id) {
    let exists = true
    if (checkExists) {
      exists = await spreadsheetStillExists(auth, user.spreadsheet_id)
    }
    if (exists) {
      if (polish) {
        try {
          await styleSpreadsheet(auth, user.spreadsheet_id)
        } catch (err) {
          if (!isSpreadsheetMissingError(err)) {
            console.warn('styleSpreadsheet skipped:', err.message)
          } else {
            const created = await createBlankKharchaSpreadsheet(auth, 'Expense Tracker')
            return { ...created, recreated: true }
          }
        }
      }
      return {
        spreadsheetId: user.spreadsheet_id,
        spreadsheetUrl:
          user.spreadsheet_url ||
          `https://docs.google.com/spreadsheets/d/${user.spreadsheet_id}/edit`,
        recreated: false,
      }
    }
    const created = await createBlankKharchaSpreadsheet(auth, 'Expense Tracker')
    return { ...created, recreated: true }
  }

  const templateId = process.env.TEMPLATE_SPREADSHEET_ID
  if (templateId) {
    try {
      const copied = await copyTemplateSpreadsheet(auth, templateId)
      await styleSpreadsheet(auth, copied.spreadsheetId)
      return { ...copied, recreated: false }
    } catch (err) {
      console.warn('template copy failed, creating blank:', err.message)
    }
  }
  const created = await createBlankKharchaSpreadsheet(auth, 'Expense Tracker')
  return { ...created, recreated: false }
}

export function isQuotaError(err) {
  const msg = String(err?.message || err || '')
  return /Quota exceeded|RATE_LIMIT|429/i.test(msg)
}

function findLastRowForDate(rows, dateObj) {
  let count = 0
  let last = 0
  for (let i = 1; i < rows.length; i++) {
    if (isBannerLabel(rows[i][0]) || isErrorCell(rows[i][0])) continue
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
      you: num(r[1]),
      partner: num(r[2]),
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

  await ensureMonthBanner(auth, spreadsheetId, dateObj)

  const cats = payload.categories || {}
  const total = EXPENSE_CATEGORIES.reduce((s, k) => s + num(cats[k]), 0)
  const dateFormula = `=DATE(${dateObj.getFullYear()},${dateObj.getMonth() + 1},${dateObj.getDate()})`
  const values = [
    dateFormula,
    total || '',
    ...EXPENSE_CATEGORIES.map((k) => blankOrNum(cats[k])),
    payload.note || '',
  ]
  // Re-read after banner write so we append after the last real row (never into the blank gap)
  const rows = await readSheetValues(auth, spreadsheetId, SHEET_EXPENSE)
  const found = findLastRowForDate(rows, dateObj)
  let row
  if (found.row) {
    await writeRow(auth, spreadsheetId, SHEET_EXPENSE, found.row, values)
    row = found.row
  } else {
    row = Math.max(rows.length + 1, 2)
    await writeRow(auth, spreadsheetId, SHEET_EXPENSE, row, values)
  }

  const sheetName = await resolveSheetName(auth, spreadsheetId, SHEET_EXPENSE)
  const meta = await getSheetMeta(auth, spreadsheetId)
  const sheetId = meta.find((s) => s.properties.title === sheetName)?.properties.sheetId
  if (sheetId != null && row) {
    await formatDataRow(auth, spreadsheetId, sheetId, row, 10, 10)
  }
  return { row, total, updated: Boolean(found.row) }
}

export async function addIncome(auth, spreadsheetId, payload) {
  const dateObj = parseISODate(payload.date)
  if (toISODate(dateObj) > toISODate(new Date())) throw new Error('Future dates are not allowed')
  const you = num(payload.you ?? payload.kalash)
  const partner = num(payload.partner ?? payload.mummy)
  const total = you + partner
  const values = [
    `=DATE(${dateObj.getFullYear()},${dateObj.getMonth() + 1},${dateObj.getDate()})`,
    blankOrNum(you),
    blankOrNum(partner),
    total || '',
    payload.source || '',
  ]
  const rows = await readSheetValues(auth, spreadsheetId, SHEET_INCOME)
  const found = findLastRowForDate(rows, dateObj)
  let row
  if (found.row) {
    await writeRow(auth, spreadsheetId, SHEET_INCOME, found.row, values)
    row = found.row
  } else {
    row = Math.max(rows.length + 1, 2)
    await writeRow(auth, spreadsheetId, SHEET_INCOME, row, values)
  }
  const sheetName = await resolveSheetName(auth, spreadsheetId, SHEET_INCOME)
  const meta = await getSheetMeta(auth, spreadsheetId)
  const sheetId = meta.find((s) => s.properties.title === sheetName)?.properties.sheetId
  if (sheetId != null && row) {
    await formatDataRow(auth, spreadsheetId, sheetId, row, 4, 4) // B–D currency; Source left
  }
  return { row, total, updated: Boolean(found.row) }
}

export async function addCreditCard(auth, spreadsheetId, payload) {
  const dateObj = parseISODate(payload.date)
  if (toISODate(dateObj) > toISODate(new Date())) throw new Error('Future dates are not allowed')
  const total = num(payload.total)
  const values = [
    `=DATE(${dateObj.getFullYear()},${dateObj.getMonth() + 1},${dateObj.getDate()})`,
    blankOrNum(total),
    payload.items || '',
  ]
  const rows = await readSheetValues(auth, spreadsheetId, SHEET_CC)
  const found = findLastRowForDate(rows, dateObj)
  let row
  if (found.row) {
    await writeRow(auth, spreadsheetId, SHEET_CC, found.row, values)
    row = found.row
  } else {
    row = Math.max(rows.length + 1, 2)
    await writeRow(auth, spreadsheetId, SHEET_CC, row, values)
  }
  const sheetName = await resolveSheetName(auth, spreadsheetId, SHEET_CC)
  const meta = await getSheetMeta(auth, spreadsheetId)
  const sheetId = meta.find((s) => s.properties.title === sheetName)?.properties.sheetId
  if (sheetId != null && row) {
    await formatDataRow(auth, spreadsheetId, sheetId, row, 2, 2) // B currency; note left
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
    if (isBannerLabel(r[0]) || isErrorCell(r[0]) || isCorruptBannerRow(r)) continue
    const d = coerceDate(r[0])
    if (!d) continue
    const key = monthKey(d)
    byMonth[key] ||= { month: key, spend: 0, income: 0, credit: 0 }
    // Prefer Total Amount (col B) so manual sheet edits win — same as personal Kharcha
    const catSum = EXPENSE_CATEGORIES.reduce((s, name, idx) => s + num(r[idx + 2]), 0)
    const spend = num(r[1]) || catSum
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
    if (isBannerLabel(r[0]) || isErrorCell(r[0]) || isCorruptBannerRow(r)) continue
    const d = coerceDate(r[0])
    if (!d || monthKey(d) !== month) continue
    const iso = toISODate(d)
    ensure(iso)
    const catSum = EXPENSE_CATEGORIES.reduce((s, name, idx) => s + num(r[idx + 2]), 0)
    const spend = num(r[1]) || catSum
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
