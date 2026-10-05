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

export function getAuthUrl() {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })
}

export async function handleOAuthCallback(code) {
  const client = createOAuthClient()
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
