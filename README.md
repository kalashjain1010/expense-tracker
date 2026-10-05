# Kharcha (public)

Personal money tracker. **Your Google Sheet, your data.**

Sign in with Google → we create a Kharcha spreadsheet **in your Drive** (you own it) → the app only reads/writes that file with your permission. We store your Google id, email, refresh token, and spreadsheet id — not your expenses.

## Stack

- `web/` — React + Vite PWA (UI)
- `server/` — Express API (Google OAuth + Sheets API)

## Local setup

### 1. Google Cloud

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Google Sheets API** and **Google Drive API**
3. OAuth consent screen → External → Testing (add your email as test user)
4. Credentials → Create OAuth client ID → Web application
   - Authorized redirect URI: `http://127.0.0.1:8787/auth/google/callback`
5. Copy Client ID + Client Secret

### 2. Install & env

```bash
cd kharcha-app
npm run install:all
cp server/.env.example server/.env
# edit server/.env with GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / SESSION_SECRET
```

```bash
# web/.env
VITE_API_BASE=http://127.0.0.1:8787
```

### 3. Run

```bash
npm run dev
```

- App: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787  

Click **Continue with Google**. On first login a spreadsheet named **Kharcha** is created in your Drive.

## Privacy

- Money data lives only in **your** Google Sheet
- Revoke access anytime: Google Account → Security → Third-party access
- For public production launch you will need Google OAuth verification

## Status

MVP: Google login, auto-create sheet, summary, expense / income / card writes, month detail.
