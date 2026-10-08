import { createClient } from '@libsql/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')

function resolveClient() {
  const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN

  if (url && !url.startsWith('file:')) {
    // Hosted Turso (production on Vercel)
    return createClient({ url, authToken })
  }

  // Local file DB for `npm run dev`
  fs.mkdirSync(dataDir, { recursive: true })
  const fileUrl = url && url.startsWith('file:') ? url : `file:${path.join(dataDir, 'kharcha.db')}`
  return createClient({ url: fileUrl })
}

const client = resolveClient()
let ready = null

async function ensureSchema() {
  if (ready) return ready
  ready = (async () => {
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        google_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        picture TEXT,
        refresh_token TEXT NOT NULL,
        spreadsheet_id TEXT,
        spreadsheet_url TEXT,
        pin_hash TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        google_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      );
    `)
    // Existing DBs created before pin_hash — add column if missing
    try {
      await client.execute('ALTER TABLE users ADD COLUMN pin_hash TEXT')
    } catch {
      /* column already exists */
    }
  })()
  return ready
}

function rowToObject(columns, values) {
  if (!values) return null
  const out = {}
  columns.forEach((col, i) => {
    out[col] = values[i]
  })
  return out
}

async function getOne(sql, args = []) {
  await ensureSchema()
  const res = await client.execute({ sql, args })
  if (!res.rows?.length) return null
  // rows may be Row objects with column names
  const row = res.rows[0]
  if (row && typeof row === 'object' && !Array.isArray(row)) {
    return { ...row }
  }
  return rowToObject(res.columns, row)
}

async function run(sql, args = []) {
  await ensureSchema()
  await client.execute({ sql, args })
}

export async function upsertUser(user) {
  await run(
    `
    INSERT INTO users (google_id, email, name, picture, refresh_token, spreadsheet_id, spreadsheet_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(google_id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture,
      refresh_token = COALESCE(excluded.refresh_token, users.refresh_token),
      spreadsheet_id = COALESCE(excluded.spreadsheet_id, users.spreadsheet_id),
      spreadsheet_url = COALESCE(excluded.spreadsheet_url, users.spreadsheet_url),
      updated_at = datetime('now')
  `,
    [
      user.google_id,
      user.email,
      user.name,
      user.picture,
      user.refresh_token,
      user.spreadsheet_id,
      user.spreadsheet_url,
    ],
  )
}

export async function getUser(googleId) {
  return getOne('SELECT * FROM users WHERE google_id = ?', [googleId])
}

export async function setUserSpreadsheet(googleId, spreadsheetId, spreadsheetUrl) {
  await run(
    `
    UPDATE users
    SET spreadsheet_id = ?, spreadsheet_url = ?, updated_at = datetime('now')
    WHERE google_id = ?
  `,
    [spreadsheetId, spreadsheetUrl, googleId],
  )
}

export async function setUserPinHash(googleId, pinHash) {
  await run(
    `
    UPDATE users
    SET pin_hash = ?, updated_at = datetime('now')
    WHERE google_id = ?
  `,
    [pinHash, googleId],
  )
}

export async function clearUserPin(googleId) {
  await run(
    `
    UPDATE users
    SET pin_hash = NULL, updated_at = datetime('now')
    WHERE google_id = ?
  `,
    [googleId],
  )
}

export async function createSession(id, googleId, expiresAtIso) {
  await run('INSERT INTO sessions (id, google_id, expires_at) VALUES (?, ?, ?)', [
    id,
    googleId,
    expiresAtIso,
  ])
}

export async function getSession(id) {
  const row = await getOne(
    `
    SELECT s.id AS session_id, s.expires_at, u.*
    FROM sessions s
    JOIN users u ON u.google_id = s.google_id
    WHERE s.id = ?
  `,
    [id],
  )
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await deleteSession(id)
    return null
  }
  // Normalize: session join used session_id alias; keep id as session cookie key separately
  return { ...row, id: row.session_id || id }
}

export async function deleteSession(id) {
  await run('DELETE FROM sessions WHERE id = ?', [id])
}
