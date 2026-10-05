import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'kharcha.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    google_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    refresh_token TEXT NOT NULL,
    spreadsheet_id TEXT,
    spreadsheet_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    google_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (google_id) REFERENCES users(google_id) ON DELETE CASCADE
  );
`)

export function upsertUser(user) {
  db.prepare(`
    INSERT INTO users (google_id, email, name, picture, refresh_token, spreadsheet_id, spreadsheet_url)
    VALUES (@google_id, @email, @name, @picture, @refresh_token, @spreadsheet_id, @spreadsheet_url)
    ON CONFLICT(google_id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture,
      refresh_token = COALESCE(excluded.refresh_token, users.refresh_token),
      spreadsheet_id = COALESCE(excluded.spreadsheet_id, users.spreadsheet_id),
      spreadsheet_url = COALESCE(excluded.spreadsheet_url, users.spreadsheet_url),
      updated_at = datetime('now')
  `).run(user)
}

export function getUser(googleId) {
  return db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId)
}

export function setUserSpreadsheet(googleId, spreadsheetId, spreadsheetUrl) {
  db.prepare(`
    UPDATE users
    SET spreadsheet_id = ?, spreadsheet_url = ?, updated_at = datetime('now')
    WHERE google_id = ?
  `).run(spreadsheetId, spreadsheetUrl, googleId)
}

export function createSession(id, googleId, expiresAtIso) {
  db.prepare(`
    INSERT INTO sessions (id, google_id, expires_at) VALUES (?, ?, ?)
  `).run(id, googleId, expiresAtIso)
}

export function getSession(id) {
  const row = db.prepare(`
    SELECT s.id, s.expires_at, u.*
    FROM sessions s
    JOIN users u ON u.google_id = s.google_id
    WHERE s.id = ?
  `).get(id)
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
    return null
  }
  return row
}

export function deleteSession(id) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
}

export { db }
