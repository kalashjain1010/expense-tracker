# Deploy Expense Tracker — free forever (Vercel + Turso)

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

1. [vercel.com](https://vercel.com) → **Add New Project** → import `expense-tracker`  
2. **Root Directory:** leave as repo root (`.`) — do **not** set `web`  
3. Framework: Other / Vite (build comes from `vercel.json`)  
4. **Environment variables** (Production):

```
APP_ORIGIN=https://YOUR-PROJECT.vercel.app
SESSION_SECRET=long-random-string
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
GOOGLE_REDIRECT_URI=https://YOUR-PROJECT.vercel.app/auth/google/callback
TURSO_DATABASE_URL=libsql://….turso.io
TURSO_AUTH_TOKEN=…
VITE_API_BASE=
```

Leave `VITE_API_BASE` **empty** so the browser calls the same domain (`/api`, `/auth`).

5. Deploy → open `https://YOUR-PROJECT.vercel.app/health` → `{"ok":true,"oauth":true}`

## 3. Google OAuth

Cloud Console → Credentials → OAuth Web client:

**Authorized JavaScript origins**
```
https://YOUR-PROJECT.vercel.app
```

**Authorized redirect URIs**
```
https://YOUR-PROJECT.vercel.app/auth/google/callback
```

(Keep local `http://127.0.0.1:5173` / `http://127.0.0.1:8787/...` for development.)

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

## Checklist

- [ ] Turso DB + token  
- [ ] Vercel env vars set (empty `VITE_API_BASE`)  
- [ ] `/health` ok  
- [ ] Google redirect = `https://….vercel.app/auth/google/callback`  
- [ ] Sign in once → sheet appears in Drive  
