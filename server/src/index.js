import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import {
  authedClientForUser,
  decodeMobileOAuthState,
  encodeMobileOAuthState,
  getAuthUrl,
  handleOAuthCallback,
  mobileAppRedirectBase,
  mobileOAuthRedirectUri,
  mobileOAuthReturnUrl,
  oauthConfigured,
  resolveMobileAppReturnTo,
} from './auth.js'
import { deleteSession, getSession, setUserSpreadsheet } from './db.js'
import {
  mergeImportIntoEntry,
  suggestCategoryWithAi,
} from './importSuggest.js'
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
    origin: true,
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

function sessionIdFromRequest(req) {
  const auth = req.headers.authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(auth)
  if (m?.[1]) return m[1].trim()
  return req.signedCookies?.[COOKIE] || req.cookies?.[COOKIE] || null
}

async function requireUser(req, res, next) {
  try {
    const sid = sessionIdFromRequest(req)
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

/** Mobile app OAuth — ends with deep link carrying Bearer session token */
app.get('/auth/google/mobile', (req, res) => {
  if (!oauthConfigured()) {
    return res.status(503).send('Google OAuth is not configured.')
  }
  const appReturn = resolveMobileAppReturnTo(req.query.return_to)
  const state = encodeMobileOAuthState(appReturn)
  res.redirect(getAuthUrl(mobileOAuthRedirectUri(), state))
})

app.get('/auth/google/mobile/callback', async (req, res) => {
  const appReturn =
    decodeMobileOAuthState(req.query.state) || mobileAppRedirectBase().split('?')[0]
  try {
    const code = req.query.code
    if (!code) throw new Error('Missing code')
    const { sessionId } = await handleOAuthCallback(String(code), mobileOAuthRedirectUri())
    const deep = mobileOAuthReturnUrl(appReturn, { token: sessionId })
    res.redirect(deep)
  } catch (err) {
    console.error(err)
    const deep = mobileOAuthReturnUrl(appReturn, {
      error: err.message || 'Auth failed',
    })
    res.redirect(deep)
  }
})

/** Mobile WebView: exchange Bearer session token for signed cookie, then open full web UI */
app.get('/auth/mobile/enter', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim()
    if (!token) return res.redirect(`${ORIGIN}/?error=${encodeURIComponent('Missing session')}`)
    const user = await getSession(token)
    if (!user) return res.redirect(`${ORIGIN}/?error=${encodeURIComponent('Session expired')}`)
    res.cookie(COOKIE, token, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    })
    res.redirect(`${ORIGIN}/`)
  } catch (err) {
    console.error(err)
    res.redirect(`${ORIGIN}/?error=${encodeURIComponent(err.message || 'Auth failed')}`)
  }
})

app.post('/auth/logout', requireUser, async (req, res) => {
  await deleteSession(req.sessionId)
  res.clearCookie(COOKIE)
  res.json({ ok: true })
})

app.get('/api/me', async (req, res) => {
  const sid = sessionIdFromRequest(req)
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

/** Suggest category for an SMS-parsed debit (rules + optional free Gemini). */
app.post('/api/expense/import-suggest', requireUser, async (req, res) => {
  try {
    const merchant = String(req.body?.merchant || '')
    const amount = Number(req.body?.amount) || 0
    const date = String(req.body?.date || '').slice(0, 10)
    const upiRef = String(req.body?.upiRef || '')
    const body = String(req.body?.body || req.body?.rawPreview || req.body?.sms || '')
    const noteDraft = [merchant && `UPI ${merchant}`, amount && `₹${amount}`, upiRef && `(${upiRef})`]
      .filter(Boolean)
      .join(' ')
    const suggestion = await suggestCategoryWithAi({
      merchant,
      amount,
      note: noteDraft,
      body: body || noteDraft,
    })
    res.json({
      ok: true,
      data: {
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
        amount,
        category: suggestion.category,
        confidence: suggestion.confidence,
        source: suggestion.source,
        noteDraft,
        merchant,
        upiRef,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(400).json({ ok: false, error: err.message || String(err) })
  }
})

/**
 * Confirm an SMS import: merge into same-day sheet row (append note, add to category).
 * Body: { date, amount, category, noteAppend?, merchant?, upiRef? }
 */
app.post('/api/expense/import', requireUser, (req, res) =>
  withSheets(req, res, async (auth, id, body) => {
    const date = String(body.date || '')
    const amount = Number(body.amount)
    const category = String(body.category || 'others')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD')
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be > 0')

    const existing = await getEntry(auth, id, 'expense', date)
    const noteAppend =
      body.noteAppend ||
      [body.merchant && `UPI ${body.merchant}`, `₹${amount}`, body.upiRef && `(${body.upiRef})`]
        .filter(Boolean)
        .join(' ')
    const merged = mergeImportIntoEntry(existing, { amount, category, noteAppend })
    const result = await addExpense(auth, id, {
      date,
      categories: merged.categories,
      note: merged.note,
    })
    return { ...result, merged: Boolean(existing?.found), note: merged.note }
  }),
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
