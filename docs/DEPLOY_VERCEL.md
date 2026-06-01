# Production hosting (Vercel + Supabase)

Production runs entirely on **Vercel** (UI + API) with **Supabase** for persistent data. No Render or other backend host is required.

| Component | Platform |
|-----------|----------|
| React UI | Vercel static (`dist/`) |
| Express API | Vercel serverless (`api/index.mjs`) |
| User access, goals, performance cache, employees | Supabase Postgres |

Primary URL example: **https://next-performance-beta.vercel.app**

---

## 1. Supabase (required for production)

Run migrations and set env vars — see [`SUPABASE_GO_LIVE.md`](SUPABASE_GO_LIVE.md).

On Vercel you **must** configure:

| Variable | Required |
|----------|----------|
| `SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `PERFORMANCE_DATA_ENCRYPTION_KEY` | Yes (encrypted Revolut cache) |

Without these, redeploys lose data and cache warming fails (Vercel has no persistent disk).

---

## 2. Vercel project

Connect the repo on [Vercel](https://vercel.com). The repo includes `vercel.json`:

- **Build:** `node scripts/prepare-vercel.mjs && npm run build:app`
- **Output:** `dist/` (SPA)
- **API:** `/api/*` → `api/index.mjs` (Express app)
- **Cron:** `/api/cron/warm-cache` daily at 06:00 UTC

### Vercel environment variables

Set in **Project → Settings → Environment Variables** (Production):

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://your-project.vercel.app` (your production URL) |
| `VITE_BYPASS_AUTH` | `false` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud |
| `SESSION_SECRET` | 32+ random chars |
| `CRON_SECRET` | Random string (Vercel sends `Authorization: Bearer …` on cron hits) |
| `ALLOWED_EMAIL_DOMAIN` | e.g. `nextventures.io` |
| `AUTH_BOOTSTRAP_ADMINS` | Comma-separated admin emails |
| `REVOLUT_EMAIL` / `REVOLUT_TOKEN` | Revolut API |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `PERFORMANCE_DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` |

Redeploy after saving env vars.

---

## 3. Google Cloud OAuth

**Authorized redirect URI:**

```text
https://your-project.vercel.app/api/auth/google/callback
```

**Authorized JavaScript origins:**

```text
https://your-project.vercel.app
```

Add preview URLs too if you want OAuth on Vercel preview deployments.

---

## 4. First deploy checklist

1. Run Supabase migrations (see `SUPABASE_GO_LIVE.md`)
2. Set all Vercel env vars above
3. Deploy to Vercel
4. Warm the cache once (Revolut fetch takes several minutes):

   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-project.vercel.app/api/cron/warm-cache
   ```

   Or wait for the scheduled cron (every 6 hours).

5. Verify: `GET /api/health` → `"platform": "vercel"`, `"supabase": true`

---

## 5. Local development

Unchanged — API runs as a long-lived Node process:

```bash
npm run dev          # Vite + local API (port 3001)
npm run cache:warm   # Optional: warm disk + Supabase cache
```

Local dev can use disk cache without Supabase; production on Vercel requires Supabase.

Optional: run the production stack locally with `npm run build:node && npm start` (serves `dist/` + API on one port).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Vercel **404** on `/api/auth/google` | Redeploy; ensure `vercel.json` rewrites `/api/:path*` → `/api` |
| Redirect to **localhost** after login | Set `APP_URL=https://your-project.vercel.app` on Vercel (not localhost) |
| `auth_failed` | Check Vercel function logs; verify `GOOGLE_*`, `SESSION_SECRET` |
| `no_access` | Add user in Supabase `dashboard_users` or via Admin → Access |
| Empty performance data | Run cache warm; verify `PERFORMANCE_DATA_ENCRYPTION_KEY` + Supabase migration `00006` |
| Cron returns 401 | Set `CRON_SECRET` on Vercel; cron sends `Authorization: Bearer <CRON_SECRET>` |
| Cache warm timeout | Pro plan allows 300s function duration (`maxDuration` in `vercel.json`) |

---

## Architecture notes

- **Sessions:** Encrypted cookies (`cookie-session`) — stateless, works on serverless
- **No disk writes on Vercel** — performance cache, goals, and access must use Supabase
- **Background refresh:** Disabled on Vercel; use cron or manual `?refresh=1` (HR/admin)
