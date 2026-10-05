# Deploy Expense Tracker — free forever (Vercel + Turso)

**Live app:** [https://trackexpense.vercel.app](https://trackexpense.vercel.app)  
(Also: [https://track-daily-expense.vercel.app](https://track-daily-expense.vercel.app))

One Vercel project serves the **web UI + API** on the same domain (cookies just work).  
Sessions/user pointers live in **Turso** (free SQLite-compatible cloud DB). Money stays in each user’s Google Sheet.

## 1. Create a free Turso database

1. Sign up at [turso.tech](https://turso.tech) (GitHub login) — Free plan, no card  
2. CLI (or dashboard → Create Database):

```bash
# optional CLI
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create expense-tracker
turso db show expense-tracker --url
turso db tokens create expense-tracker
```

3. Copy:
   - `TURSO_DATABASE_URL` → `libsql://expense-tracker-….turso.io`
   - `TURSO_AUTH_TOKEN` → the token

## 2. Deploy on Vercel (one project)

Already live as project **trackdailyexpense**:
- Primary: https://trackexpense.vercel.app  
- Alias: https://track-daily-expense.vercel.app  

If recreating from scratch:

1. [vercel.com](https://vercel.com) → **Add New Project** → import `expense-tracker`  
2. **Root Directory:** leave as repo root (`.`) — do **not** set `web`  
3. Framework: Other / Vite (build comes from `vercel.json`)  
4. **Environment variables** (Production):

```
APP_ORIGIN=https://trackexpense.vercel.app
SESSION_SECRET=long-random-string
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
GOOGLE_REDIRECT_URI=https://trackexpense.vercel.app/auth/google/callback
TURSO_DATABASE_URL=libsql://….turso.io
TURSO_AUTH_TOKEN=…
```

Leave `VITE_API_BASE` unset/empty so the browser calls the same domain (`/api`, `/auth`).

5. Deploy → open `https://trackexpense.vercel.app/health` → `{"ok":true,"oauth":true}`

## 3. Google OAuth (do this so anyone can sign in)

Cloud Console → Credentials → OAuth Web client:

**Authorized JavaScript origins**
```
https://trackexpense.vercel.app
https://track-daily-expense.vercel.app
```

**Authorized redirect URIs**
```
https://trackexpense.vercel.app/auth/google/callback
https://track-daily-expense.vercel.app/auth/google/callback
```

(Keep local `http://127.0.0.1:5173` / `http://127.0.0.1:8787/...` for development.)

Then **OAuth consent screen → Publish app** (and add a privacy policy URL) so users outside your test list can sign in. Sheets scopes may show “unverified” until Google verifies.

## 4. Local development (unchanged)

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
# fill Google keys; leave TURSO_* empty → uses local file DB
npm run install:all
npm run dev
```

- App: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787  

## 5. Open for any Google user

OAuth consent **Testing** = only Test users.  
**Publish app** (+ privacy policy URL) when you want anyone to sign in. Sheets scopes may show “unverified” until Google verifies.

## Why not Railway?

Railway’s free trial is short; always-on needs ~$5/mo. This stack stays on free tiers (Vercel Hobby + Turso Free) within normal personal-use quotas.

## Mobile app (Android SMS import)

Internal APK repo: [expense-tracker-mobile](https://github.com/kalashjain1010/expense-tracker-mobile)

Add this **Authorized redirect URI** on the same Google OAuth Web client:
```
https://trackexpense.vercel.app/auth/google/mobile/callback
```

Optional Vercel env:
```
GOOGLE_MOBILE_REDIRECT_URI=https://trackexpense.vercel.app/auth/google/mobile/callback
MOBILE_APP_REDIRECT=expensetracker://auth/callback
GEMINI_API_KEY=
```

Routes: `/auth/google/mobile`, `/auth/google/mobile/callback`, `POST /api/expense/import-suggest`, `POST /api/expense/import` (Bearer session supported).
  
