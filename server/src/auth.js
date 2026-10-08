import { google } from 'googleapis'
import { nanoid } from 'nanoid'
import {
  createSession,
  getUser,
  setUserSpreadsheet,
  upsertUser,
} from './db.js'
import { ensureUserSpreadsheet } from './sheets.js'

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
]

export function oauthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function resolveRedirectUri(redirectUri) {
  if (redirectUri) return redirectUri
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI
  // On Vercel, never fall back to localhost — use the public app origin
  const origin = process.env.APP_ORIGIN
  if (origin && !/localhost|127\.0\.0\.1/i.test(origin)) {
    return `${origin.replace(/\/$/, '')}/auth/google/callback`
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/auth/google/callback`
  }
  return 'http://127.0.0.1:8787/auth/google/callback'
}

export function createOAuthClient(redirectUri) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    resolveRedirectUri(redirectUri),
  )
}

export function getAuthUrl(redirectUri, state) {
  const client = createOAuthClient(redirectUri)
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    ...(state ? { state } : {}),
  })
}

/** Deep link used after mobile OAuth completes (custom scheme). */
export function mobileAppRedirectBase() {
  return process.env.MOBILE_APP_REDIRECT || 'expensetracker://auth/callback'
}

export function mobileOAuthRedirectUri() {
  if (process.env.GOOGLE_MOBILE_REDIRECT_URI) return process.env.GOOGLE_MOBILE_REDIRECT_URI
  const origin = process.env.APP_ORIGIN
  if (origin && !/localhost|127\.0\.0\.1/i.test(origin)) {
    return `${origin.replace(/\/$/, '')}/auth/google/mobile/callback`
  }
  return resolveRedirectUri()
}

/** Where the mobile OAuth flow sends the user after Google (deep link or local web). */
export function resolveMobileAppReturnTo(returnTo) {
  const fallback = mobileAppRedirectBase().split('?')[0]
  if (!returnTo || typeof returnTo !== 'string') return fallback
  try {
    const u = new URL(returnTo)
    if (u.protocol === 'expensetracker:' && u.hostname === 'auth' && u.pathname === '/callback') {
      return 'expensetracker://auth/callback'
    }
    if (
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
    ) {
      const path = u.pathname === '/' ? '' : u.pathname
      return `${u.origin}${path}`
    }
  } catch {
    /* ignore */
  }
  return fallback
}

export function encodeMobileOAuthState(appReturnTo) {
  return Buffer.from(JSON.stringify({ r: appReturnTo }), 'utf8').toString('base64url')
}

export function decodeMobileOAuthState(state) {
  if (!state) return null
  try {
    const parsed = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'))
    if (parsed?.r) return resolveMobileAppReturnTo(parsed.r)
  } catch {
    /* ignore */
  }
  return null
}

export function mobileOAuthReturnUrl(base, query) {
  const qs = new URLSearchParams(query).toString()
  if (!qs) return base
  return base.includes('?') ? `${base}&${qs}` : `${base}?${qs}`
}

export async function handleOAuthCallback(code, redirectUri) {
  const client = createOAuthClient(redirectUri)
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const { data: profile } = await oauth2.userinfo.get()

  if (!profile.id || !profile.email) {
    throw new Error('Google profile missing id/email')
  }

  const existing = await getUser(profile.id)
  const refreshToken = tokens.refresh_token || existing?.refresh_token
  if (!refreshToken) {
    throw new Error('No refresh token from Google. Revoke app access and sign in again.')
  }

  await upsertUser({
    google_id: profile.id,
    email: profile.email,
    name: profile.name || '',
    picture: profile.picture || '',
    refresh_token: refreshToken,
    spreadsheet_id: existing?.spreadsheet_id || null,
    spreadsheet_url: existing?.spreadsheet_url || null,
  })

  client.setCredentials({ refresh_token: refreshToken })
  // Skip heavy polish on login (Vercel serverless time limit) — chrome runs later
  const sheet = await ensureUserSpreadsheet(client, await getUser(profile.id), { polish: false })
  if (sheet?.spreadsheetId) {
    await setUserSpreadsheet(profile.id, sheet.spreadsheetId, sheet.spreadsheetUrl)
  }

  const sessionId = nanoid(32)
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  await createSession(sessionId, profile.id, expires)

  const user = await getUser(profile.id)
  return { sessionId, user }
}

export function authedClientForUser(user) {
  const client = createOAuthClient()
  client.setCredentials({ refresh_token: user.refresh_token })
  return client
}
