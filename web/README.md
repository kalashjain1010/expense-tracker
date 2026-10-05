# Kharcha Tracker

Mobile-friendly **PWA** for logging daily expenses, income, and credit card spends into your existing Google Sheet — plus a dashboard (this month so far, by month, top categories).

Sheet: [Copy of Daily kharcha nEw test](https://docs.google.com/spreadsheets/d/1rCdFvBue-ojOGgpry9zhAK_djDL3HU5j1AVpi_iWaVc/edit)

## Features

- **Spend** — date (defaults to today), categories (Food, Groceries, Investments, Wants, Travel, needs, Rent & utils, others), optional note → writes `daily Kharcha`
- **Income** — Kalash / Mummy / Source → writes `Income`
- **Card** — total + item breakdown → writes `Credit card spends`
- **Home dashboard** — MTD spend, income, credit card, net; spend-by-month chart; top categories; recent activity
- **Month banners** — when a new month starts, inserts a row like `January 2026` with a **live SUMIFS formula** in Total Amount (always up to date)

## Quick start (UI only / demo)

```bash
cd ~/Desktop/kharcha-tracker
npm install
npm run dev
```

Open the local URL. Until Apps Script is connected, the app runs in **Demo mode** (UI works; saves do not hit your sheet).

## Connect your Google Sheet (required for real writes)

### 1. Install the Apps Script backend

1. Open your sheet → **Extensions → Apps Script**
2. Delete any default code; paste everything from [`apps-script/Code.gs`](apps-script/Code.gs)
3. Save the project (name it `Kharcha API`)

### 2. Set a secret

1. Apps Script → **Project Settings** (gear) → **Script properties**
2. Add property:
   - Key: `API_SECRET`
   - Value: a long random string (e.g. from a password manager)

### 3. Deploy as web app

1. **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy → copy the **Web app URL**

> “Anyone” means anyone who has the URL *and* your secret can write. Do not post the URL publicly.

### 4. Configure the PWA

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_API_URL=https://script.google.com/macros/s/PASTE_DEPLOYMENT_ID/exec
VITE_API_SECRET=the-same-secret-as-script-properties
```

Restart `npm run dev`. The “Demo mode” pill should disappear.

### 5. Use on your phone

1. Deploy the frontend free (Cloudflare Pages / Vercel / Netlify), **or** tunnel your local URL
2. On phone Safari/Chrome → **Add to Home Screen**
3. Open **Kharcha** like an app

## Privacy

- The app shows a **PIN lock screen** before anything loads (`VITE_APP_PIN` in `.env`). Unlock lasts for this browser tab only — closing the tab locks again. You can also tap the lock icon in the top bar.
- Keep your **Google Sheet** shared only with you.
- Apps Script stays “Anyone” + secret (needed for phone access); do not post the web app URL publicly.

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Local development |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |

## Stack

- React + Vite PWA (phone + desktop)
- Recharts for dashboard charts
- Google Apps Script JSON API (free, sheet stays private)

## Notes

- Empty categories are left blank (not `0`), matching your sheet habit
- Row **Total Amount** is calculated by the app before write
- New month banners use formulas on columns C–J so totals stay correct as you add rows
- Older text banners like `January 90025` are left unchanged; only **new** months get formulas
