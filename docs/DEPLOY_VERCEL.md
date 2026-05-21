# Production hosting (Render + Vercel)

Use **one primary URL** for your team. Both setups below are supported after the latest deploy.

| URL | Role |
|-----|------|
| **https://next-performance.onrender.com** | **Recommended** — full app (UI + API) |
| **https://next-performance-beta.vercel.app** | UI on Vercel, `/api` proxied to Render |

---

## A. Render only (recommended)

Repo includes [`render.yaml`](../render.yaml). Connect the repo on [Render](https://render.com).

### Render environment variables

Set in the dashboard (or Blueprint); **do not use localhost**:

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://next-performance.onrender.com` |
| `VITE_BYPASS_AUTH` | `false` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud |
| `SESSION_SECRET` | 32+ random chars |
| `ALLOWED_EMAIL_DOMAIN` | e.g. `nextventures.io` |
| `REVOLUT_EMAIL` / `REVOLUT_TOKEN` | Revolut API |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | optional |

**Build:** `NPM_CONFIG_PRODUCTION=false npm install && npm run build`  
**Start:** `npm start`

If the build fails with `tsc: command not found`, `NODE_ENV=production` was set during install — use the build command above (see `render.yaml`).

Share **only** the Render URL with users.

---

## B. Vercel + Render API

### 1. Render (same service as A)

Keep the API running at `https://next-performance.onrender.com`.

You may **delete** `APP_URL` on Render or set it to either public URL — OAuth now uses the **request Host** (`x-forwarded-host`) so Vercel and Render both work.

### 2. Vercel

**Project → Settings → Environment Variables** (Production):

| Variable | Value |
|----------|--------|
| `API_BACKEND_URL` | `https://next-performance.onrender.com` |
| `VITE_BYPASS_AUTH` | `false` |

Redeploy after saving. The repo includes:

- `api/[...path].js` — proxies `/api/*` to Render (fixes **404** on login)
- `vercel.json` — SPA routing for React

### 3. Google Cloud OAuth

Add **both** redirect URIs if you use both hosts:

```text
https://next-performance.onrender.com/api/auth/google/callback
https://next-performance-beta.vercel.app/api/auth/google/callback
```

**Authorized JavaScript origins:**

```text
https://next-performance.onrender.com
https://next-performance-beta.vercel.app
```

---

## Verify

| Test | Expected |
|------|----------|
| `https://next-performance.onrender.com/api/auth/google` | Redirect to Google |
| `https://next-performance-beta.vercel.app/api/auth/google` | Redirect to Google (not 404) |
| After Google login | Same host you started from (not `localhost`) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Vercel **404** on `/api/auth/google` | Set `API_BACKEND_URL=https://next-performance.onrender.com`, redeploy Vercel |
| Redirect to **localhost** after login | Remove `APP_URL=http://localhost:5173` from Render; redeploy Render with latest code |
| `auth_failed` | Check Render logs; `GOOGLE_*`, `SESSION_SECRET` |
| `no_access` | Add user in Supabase or `access.json` on Render |
