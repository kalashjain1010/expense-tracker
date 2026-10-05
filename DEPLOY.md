# Deploy Expense Tracker

The app has two parts:
- **web/** → Vercel (frontend)
- **server/** → a small always-on host (Railway / Render / Fly) — Google OAuth needs a real backend

## 1. Deploy the API (Railway example — free tier)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub → pick `expense-tracker`
2. Set **Root Directory** to `server`
3. Add variables:

```
PORT=8787
APP_ORIGIN=https://YOUR-VERCEL-DOMAIN.vercel.app
SESSION_SECRET=long-random-string
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR-RAILWAY-DOMAIN.up.railway.app/auth/google/callback
```

4. Deploy → copy the public API URL (e.g. `https://expense-tracker-api.up.railway.app`)

## 2. Deploy the web app (Vercel)

1. [vercel.com](https://vercel.com) → Add New Project → import `expense-tracker`
2. **Root Directory:** `web`
3. Framework: Vite (auto)
4. Environment variable:

```
VITE_API_BASE=https://YOUR-RAILWAY-DOMAIN.up.railway.app
```

5. Deploy → copy the Vercel URL

## 3. Update Google OAuth for production

In Google Cloud → **Credentials** → your OAuth Web client:

**Authorised JavaScript origins**
```
https://YOUR-VERCEL-DOMAIN.vercel.app
```

**Authorised redirect URIs**
```
https://YOUR-RAILWAY-DOMAIN.up.railway.app/auth/google/callback
```

(Keep the local `127.0.0.1` URIs too if you still develop locally.)

Also set Railway `APP_ORIGIN` to the exact Vercel URL (no trailing slash).

## 4. Open the app for any Google user

While status is **Testing**, only emails on **Test users** can sign in.

### Option A — stay in Testing (friends / beta)
OAuth consent screen → Test users → add each email (up to 100).

### Option B — public (anyone with Google)
1. OAuth consent screen → App name: **Expense Tracker** → add a **Privacy Policy URL**
2. Confirm scopes: Drive File + Spreadsheets + profile/email
3. Click **Publish app**
4. For Drive/Sheets scopes Google usually asks for **verification**. Until verified, users see “unverified app” and can continue via Advanced → Go to App.
5. After verification, anyone can sign in with Google.

## Checklist

- [ ] Sheets API + Drive API enabled
- [ ] API deployed with env vars
- [ ] Vercel `VITE_API_BASE` points at API
- [ ] Google redirect URI matches API `/auth/google/callback`
- [ ] `APP_ORIGIN` matches Vercel URL
- [ ] Test users added **or** app published
