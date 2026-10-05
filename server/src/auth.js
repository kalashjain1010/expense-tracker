import { google } from 'googleapis'
import {
  createSession,
  getUser,
  setUserSpreadsheet,
  upsertUser,
} from './db.js'
import { ensureUserSpreadsheet } from './sheets.js'
import { nanoid } from 'nanoid'

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

export function createOAuthClient(redirectUri = process.env.GOOGLE_REDIRECT_URI) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
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

  const existing = getUser(profile.id)
  const refreshToken = tokens.refresh_token || existing?.refresh_token
  if (!refreshToken) {
    throw new Error('No refresh token from Google. Revoke app access and sign in again.')
  }

  upsertUser({
    google_id: profile.id,
    email: profile.email,
    name: profile.name || '',
    picture: profile.picture || '',
    refresh_token: refreshToken,
    spreadsheet_id: existing?.spreadsheet_id || null,
    spreadsheet_url: existing?.spreadsheet_url || null,
  })

  client.setCredentials({ refresh_token: refreshToken })
  const sheet = await ensureUserSpreadsheet(client, getUser(profile.id))
  if (sheet?.spreadsheetId) {
    setUserSpreadsheet(profile.id, sheet.spreadsheetId, sheet.spreadsheetUrl)
  }

  const sessionId = nanoid(32)
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  createSession(sessionId, profile.id, expires)

  const user = getUser(profile.id)
  return { sessionId, user }
}

export function authedClientForUser(user) {
  const client = createOAuthClient()
  client.setCredentials({ refresh_token: user.refresh_token })
  return client
}
