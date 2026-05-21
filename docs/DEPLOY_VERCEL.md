# Deploy on Vercel (frontend) + API backend

Vercel only hosts the **Vite static app**. Google login and Revolut data need the **Express API** (`server/`). Use **two services**:

| Service | Hosts | Example |
|---------|--------|---------|
| **Vercel** | React UI (`dist/`) | `https://next-performance-beta.vercel.app` |
| **Render** (or Railway) | Node API only | `https://next-performance-api.onrender.com` |

Vercel **rewrites** `/api/*` to the backend so the browser stays on one origin (cookies + OAuth work).

---

## 1. Deploy the API (Render)

1. [Render](https://render.com) → **New → Web Service** → connect `aminulnv/NEXT-Performance`.
2. Settings:

| Field | Value |
|-------|--------|
| **Name** | `next-performance-api` |
| **Root directory** | *(leave empty)* |
| **Build command** | `npm install` |
| **Start command** | `node server/index.mjs` |
| **Instance** | Free (spins down when idle) |

3. **Environment** (same secrets as local `.env`, but production values):

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `APP_URL` | **`https://YOUR-VERCEL-APP.vercel.app`** (no trailing slash) |
| `GOOGLE_CLIENT_ID` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `SESSION_SECRET` | 32+ random characters |
| `ALLOWED_EMAIL_DOMAIN` | e.g. `nextventures.io` |
| `VITE_BYPASS_AUTH` | `false` |
| `REVOLUT_EMAIL` / `REVOLUT_TOKEN` | Revolut API |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | if using Supabase users |

4. Deploy and copy the public URL, e.g. `https://next-performance-api.onrender.com`.

5. Smoke test (should redirect to Google or show an error page, not 404):

   `https://next-performance-api.onrender.com/api/auth/google`

---

## 2. Configure Vercel

**Project → Settings → Environment Variables** (Production + Preview):

| Variable | Value |
|----------|--------|
| `API_BACKEND_URL` | `https://next-performance-api.onrender.com` (no trailing slash) |
| `VITE_BYPASS_AUTH` | `false` |

Plus any `VITE_*` vars you use in the client.

**Build:** The repo `vercel.json` runs `node scripts/prepare-vercel.mjs` then builds the app.  
`prepare-vercel.mjs` reads `API_BACKEND_URL` and writes `/api` rewrites.

**Redeploy** after setting `API_BACKEND_URL`.

---

## 3. Google Cloud OAuth

[Credentials](https://console.cloud.google.com/apis/credentials) → your **Web client**:

| Field | Value |
|-------|--------|
| **Authorized JavaScript origins** | `https://YOUR-VERCEL-APP.vercel.app` |
| **Authorized redirect URIs** | `https://YOUR-VERCEL-APP.vercel.app/api/auth/google/callback` |

Use the **Vercel** URL, not the Render URL. The browser only talks to Vercel; Vercel proxies `/api` to Render.

`APP_URL` on Render must match the Vercel URL exactly.

---

## 4. Verify

1. Open `https://YOUR-VERCEL-APP.vercel.app/api/auth/google`  
   → should redirect to **accounts.google.com** (not 404).
2. Sign in with an email on your access list (Supabase / `access.json` on the API host).
3. Dashboard loads performance data (first load can take 1–2 minutes).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `/api/auth/google` 404 on Vercel | Set `API_BACKEND_URL` and redeploy |
| Redirect to Google then `auth_failed` | Check Render logs; verify `GOOGLE_*`, `SESSION_SECRET`, `APP_URL` |
| `domain_not_allowed` | `ALLOWED_EMAIL_DOMAIN` must match email domain |
| `no_access` | Add user in Supabase `dashboard_users` or API `access.json` |
| Login works, no data | `REVOLUT_*` on Render; run `npm run cache:warm` on Render shell if needed |
| Cold start / timeout | Render free tier sleeps; first request may be slow. Long Revolut refresh runs on **Render**, not Vercel’s 10s function limit (rewrite proxies to Render). |

---

## Single-host alternative

If two services is too much, deploy **only on Render** with `npm run build && npm start` — one URL, no Vercel proxy. See `docs/SUPABASE_GO_LIVE.md` §6.
