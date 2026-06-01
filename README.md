# Performance Dashboard

React dashboard for **Revolut People** final grades and scorecard data. **Google login** and **role-based page access** are supported (see [`docs/AUTH.md`](docs/AUTH.md)). Auth is **bypassed** in local dev when `VITE_BYPASS_AUTH=true`. Data is loaded **live from the Revolut API** via a small local proxy (credentials stay on the server, not in the browser).

## Site structure

| Section | Routes | Purpose |
|---------|--------|---------|
| **Home** | `/` | Snapshot KPIs, grade distribution, quick links |
| **Organization** | `/organization/people`, `/organization/departments` | Unique employees and department comparisons |
| **Performance** | `/performance/records`, `/performance/cycles`, `/performance/scorecards/:id` | Review records (all or scorecards tab), cycles, scorecard detail |
| **Goals** | `/goals` | Goals CSV import and browse |
| **Analytics** | `/analytics/explore`, `/analytics/monitoring`, `/analytics/reviewers`, `/analytics/calibration` | Explore, program monitoring, reviewer timing, calibration |
| **Admin** | `/admin/settings`, `/admin/data-health`, `/admin/access` | Preferences, sync status, user access |
| **Account** | `/account/profile` | Profile (user menu; not in sidebar) |

Legacy paths (`/reviews/*`, `/insights/*`, `/employees`, `/overview`, etc.) redirect to the new URLs.

## Prerequisites

- Node 18+
- Revolut People API credentials (same as your n8n **Revolut Login** node)

## Quick start

```bash
cp .env.example .env
cp server/data/access.json.example server/data/access.json
```

Edit `.env`:

```env
REVOLUT_EMAIL=hr-analytics@yourcompany.com
REVOLUT_TOKEN=your-api-token
VITE_BYPASS_AUTH=true
```

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. The first load calls Revolut (employees, final grades, timeline, scorecards) and may take **1–2 minutes**. Results are cached in memory for 5 minutes (`API_CACHE_MS`).

## Architecture

| Piece | Role |
|--------|------|
| `server/app.mjs` | Express API — login + fetch + flatten |
| `server/index.mjs` | Local dev server entry |
| `api/index.mjs` | Vercel serverless entry (same Express app) |
| `server/flatten.mjs` | Super-table flatten (employees, grades, timeline, scorecards) |
| Vite proxy `/api` → `localhost:3001` | Keeps `REVOLUT_*` secrets off the frontend |

The dashboard reads **live Revolut API** data (or disk cache) for performance records. **Goals** have no API—upload the Revolut CSV on **Goals** or **Analytics → Monitoring** (see [`docs/GOALS.md`](docs/GOALS.md)).

Set `INCLUDE_ALL_SCORECARDS=true` (default) to embed every scorecard for a grade in `All Scorecards (JSON)` on each record.

## Scripts

- `npm run dev` — API + Vite together
- `npm run dev:api` — API only
- `npm run dev:web` — Vite only
- `npm run build` — production frontend build
- `npm test` — unit tests (metrics, scorecard payload)
- `npm run start:api` — API for production (serve `dist` separately)

## Auth and roles

See [`docs/AUTH.md`](docs/AUTH.md). Set `VITE_BYPASS_AUTH=false`, configure Google OAuth in `.env`, add users under **Admin → Access**, and edit role page lists in `src/config/permissions.json`.

## Hosting

Production: **Vercel** (UI + API) + **Supabase** (data). See [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md) and [`docs/SUPABASE_GO_LIVE.md`](docs/SUPABASE_GO_LIVE.md).

Local full-stack (optional): `npm run build:node && npm start`

## Supabase (go-live)

See [`docs/SUPABASE_GO_LIVE.md`](docs/SUPABASE_GO_LIVE.md). Run migrations in the Supabase SQL Editor, set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, then user access is stored in `dashboard_users` (survives redeploys).
