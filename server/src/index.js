import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import {
  authedClientForUser,
  getAuthUrl,
  handleOAuthCallback,
  oauthConfigured,
} from './auth.js'
import { deleteSession, getSession, setUserSpreadsheet } from './db.js'
import {
  addCreditCard,
  addExpense,
  addIncome,
  applySheetChrome,
  buildSummary,
  ensureUserSpreadsheet,
  getEntry,
  getMonthDetail,
  isQuotaError,
  isSpreadsheetMissingError,
  SHEET_LAYOUT_VERSION,
  styleSpreadsheet,
} from './sheets.js'

const app = express()
const PORT = Number(process.env.PORT || 8787)
const ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173'
const COOKIE = 'kharcha_session'
const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)

/** googleId -> layout version last applied (avoid Sheets quota from restyling every request) */
const layoutApplied = new Map()

app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-secret'))

function publicUser(row) {
  if (!row) return null
  return {
    email: row.email,
    name: row.name,
    picture: row.picture,
    spreadsheetId: row.spreadsheet_id,
    spreadsheetUrl: row.spreadsheet_url,
  }
}

async function requireUser(req, res, next) {
  try {
    const sid = req.signedCookies?.[COOKIE] || req.cookies?.[COOKIE]
    if (!sid) return res.status(401).json({ ok: false, error: 'Not signed in' })
    const user = await getSession(sid)
    if (!user) return res.status(401).json({ ok: false, error: 'Session expired' })
    req.sessionId = sid
    req.user = user
    next()
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Session error' })
  }
}

/** If Drive file was deleted, create a fresh empty sheet and remember it. */
async function recoverSpreadsheetIfNeeded(req, { polish = false, checkExists = false } = {}) {
  if (req.user.spreadsheet_id && !polish && !checkExists) {
    return {
      spreadsheetId: req.user.spreadsheet_id,
      spreadsheetUrl: req.user.spreadsheet_url,
      recreated: false,
    }
  }
  const auth = authedClientForUser(req.user)
  const sheet = await ensureUserSpreadsheet(auth, req.user, { polish, checkExists })
  if (sheet.recreated || sheet.spreadsheetId !== req.user.spreadsheet_id) {
    await setUserSpreadsheet(req.user.google_id, sheet.spreadsheetId, sheet.spreadsheetUrl)
    req.user.spreadsheet_id = sheet.spreadsheetId
    req.user.spreadsheet_url = sheet.spreadsheetUrl
    layoutApplied.delete(req.user.google_id)
  }
  return sheet
}

/** Apply column widths / alignment at most once per layout version (not every page load). */
async function maybeApplySheetChrome(req) {
  if (!req.user?.spreadsheet_id) return
  const id = req.user.google_id
  const state = layoutApplied.get(id)
  if (state === SHEET_LAYOUT_VERSION) return
  if (typeof state === 'number' && state > Date.now()) return
  try {
    const auth = authedClientForUser(req.user)
    await applySheetChrome(auth, req.user.spreadsheet_id)
    layoutApplied.set(id, SHEET_LAYOUT_VERSION)
  } catch (err) {
    if (isQuotaError(err)) {
      layoutApplied.set(id, Date.now() + 2 * 60 * 1000)
      console.warn('applySheetChrome deferred (quota):', err.message)
      return
    }
    if (isSpreadsheetMissingError(err)) throw err
    console.warn('applySheetChrome skipped:', err.message)
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, oauth: oauthConfigured() })
})

app.get('/auth/google', (_req, res) => {
  if (!oauthConfigured()) {
    return res.status(503).send('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.')
  }
  res.redirect(getAuthUrl())
})

app.get('/auth/google/callback', async (req, res) => {
  try {
    const code = req.query.code
    if (!code) throw new Error('Missing code')
    const { sessionId } = await handleOAuthCallback(String(code))
    res.cookie(COOKIE, sessionId, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    })
    res.redirect(`${ORIGIN}/`)
  } catch (err) {
    console.error(err)
    res.redirect(`${ORIGIN}/login?error=${encodeURIComponent(err.message || 'Auth failed')}`)
  }
})

app.post('/auth/logout', requireUser, async (req, res) => {
  await deleteSession(req.sessionId)
  res.clearCookie(COOKIE)
  res.json({ ok: true })
})

app.get('/api/me', async (req, res) => {
  const sid = req.signedCookies?.[COOKIE] || req.cookies?.[COOKIE]
  if (!sid) return res.json({ ok: true, data: { user: null } })
  try {
    const user = await getSession(sid)
    if (!user) return res.json({ ok: true, data: { user: null } })
    res.json({ ok: true, data: { user: publicUser(user) } })
  } catch (err) {
    console.error(err)
    res.json({ ok: true, data: { user: null } })
  }
})

async function withSheets(req, res, fn) {
  try {
    await recoverSpreadsheetIfNeeded(req, { checkExists: false })
    if (!req.user.spreadsheet_id) {
      await recoverSpreadsheetIfNeeded(req, { polish: true, checkExists: false })
    }
    if (!req.user.spreadsheet_id) {
      return res.status(400).json({ ok: false, error: 'Could not create spreadsheet. Try signing in again.' })
    }
    const auth = authedClientForUser(req.user)
    try {
      const data = await fn(auth, req.user.spreadsheet_id, req.body || {})
      maybeApplySheetChrome(req).catch((err) => console.warn('chrome:', err.message))
      return res.json({ ok: true, data })
    } catch (err) {
      if (isQuotaError(err)) {
        return res.status(429).json({
          ok: false,
          error: 'Google Sheets is rate-limiting us. Wait about a minute, then try again.',
        })
      }
      if (!isSpreadsheetMissingError(err)) throw err
      const auth2 = authedClientForUser(req.user)
      const created = await ensureUserSpreadsheet(auth2, { ...req.user, spreadsheet_id: null })
      await setUserSpreadsheet(req.user.google_id, created.spreadsheetId, created.spreadsheetUrl)
      req.user.spreadsheet_id = created.spreadsheetId
      req.user.spreadsheet_url = created.spreadsheetUrl
      layoutApplied.delete(req.user.google_id)
      const data = await fn(auth2, created.spreadsheetId, req.body || {})
      return res.json({ ok: true, data, sheetRecreated: true })
    }
  } catch (err) {
    console.error(err)
    if (isQuotaError(err)) {
      return res.status(429).json({
        ok: false,
        error: 'Google Sheets is rate-limiting us. Wait about a minute, then try again.',
      })
    }
    res.status(400).json({ ok: false, error: err.message || String(err) })
  }
}

app.get('/api/summary', requireUser, (req, res) => withSheets(req, res, buildSummary))

app.get('/api/month', requireUser, (req, res) => {
  const month = String(req.query.month || '')
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ ok: false, error: 'month must be YYYY-MM' })
  }
  return withSheets(req, res, (auth, id) => getMonthDetail(auth, id, month))
})

app.get('/api/entry', requireUser, (req, res) => {
  const type = String(req.query.type || 'expense')
  const date = String(req.query.date || '')
  if (!date) return res.status(400).json({ ok: false, error: 'date required' })
  return withSheets(req, res, (auth, id) => getEntry(auth, id, type, date))
})

app.post('/api/expense', requireUser, (req, res) =>
  withSheets(req, res, (auth, id, body) => addExpense(auth, id, body)),
)
app.post('/api/income', requireUser, (req, res) =>
  withSheets(req, res, (auth, id, body) => addIncome(auth, id, body)),
)
app.post('/api/credit', requireUser, (req, res) =>
  withSheets(req, res, (auth, id, body) => addCreditCard(auth, id, body)),
)

app.post('/api/sheet/style', requireUser, (req, res) =>
  withSheets(req, res, (auth, id) => styleSpreadsheet(auth, id)),
)

export default app

/** Local / Railway-style listen — skipped on Vercel serverless */
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Expense Tracker API on http://127.0.0.1:${PORT}`)
    if (!oauthConfigured()) {
      console.warn('Google OAuth not configured yet — fill server/.env from .env.example')
    }
  })
}
