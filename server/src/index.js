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
import { deleteSession, getSession } from './db.js'
import {
  addCreditCard,
  addExpense,
  addIncome,
  buildSummary,
  getEntry,
  getMonthDetail,
} from './sheets.js'

const app = express()
const PORT = Number(process.env.PORT || 8787)
const ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173'
const COOKIE = 'kharcha_session'

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

function requireUser(req, res, next) {
  const sid = req.signedCookies?.[COOKIE] || req.cookies?.[COOKIE]
  if (!sid) return res.status(401).json({ ok: false, error: 'Not signed in' })
  const user = getSession(sid)
  if (!user) return res.status(401).json({ ok: false, error: 'Session expired' })
  req.sessionId = sid
  req.user = user
  next()
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
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    })
    res.redirect(`${ORIGIN}/`)
  } catch (err) {
    console.error(err)
    res.redirect(`${ORIGIN}/login?error=${encodeURIComponent(err.message || 'Auth failed')}`)
  }
})

app.post('/auth/logout', requireUser, (req, res) => {
  deleteSession(req.sessionId)
  res.clearCookie(COOKIE)
  res.json({ ok: true })
})

app.get('/api/me', (req, res) => {
  const sid = req.signedCookies?.[COOKIE] || req.cookies?.[COOKIE]
  if (!sid) return res.json({ ok: true, data: { user: null } })
  const user = getSession(sid)
  res.json({ ok: true, data: { user: publicUser(user) } })
})

async function withSheets(req, res, fn) {
  try {
    if (!req.user.spreadsheet_id) {
      return res.status(400).json({ ok: false, error: 'No spreadsheet linked yet. Sign out and sign in again.' })
    }
    const auth = authedClientForUser(req.user)
    const data = await fn(auth, req.user.spreadsheet_id, req.body || {})
    res.json({ ok: true, data })
  } catch (err) {
    console.error(err)
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

app.listen(PORT, () => {
  console.log(`Kharcha API on http://127.0.0.1:${PORT}`)
  if (!oauthConfigured()) {
    console.warn('Google OAuth not configured yet — fill server/.env from .env.example')
  }
})
