# Expense Tracker

Personal money tracker. **Your Google Sheet, your data.**

Sign in with Google → we create a polished spreadsheet in **your** Drive → log spend, income, and card. We only store your Google id, email, refresh token, and spreadsheet id — not your money rows.

## Features

- Google Sign-In
- Auto-creates a styled sheet (`Spend` / `Income` / `Card`) in the user’s Drive
- Home dashboard (MTD, charts, month detail)
- Mobile-friendly PWA UI

## Local setup

See steps below. For production: **[DEPLOY.md](DEPLOY.md)**.

1. Google Cloud project → enable **Sheets API** + **Drive API**
2. OAuth consent (Testing) → add yourself as test user
3. OAuth Web client redirect: `http://127.0.0.1:8787/auth/google/callback`
4. Configure env:

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
# fill GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SESSION_SECRET
npm run install:all
npm run dev
```

- App: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787  

## Stack

- `web/` — React + Vite PWA
- `server/` — Express + Google OAuth + Sheets API + Turso/libsql (session pointers only)
- Production: **Vercel** (UI + API, same domain) + free **Turso** DB — see [DEPLOY.md](DEPLOY.md)

## Privacy

Money data lives only in the user’s Google Sheet. Revoke anytime under Google Account → Security → Third-party access.
