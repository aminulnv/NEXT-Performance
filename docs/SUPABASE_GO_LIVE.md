# Supabase go-live setup

Use Supabase for **persistent user access** (no more lost `access.json` on redeploy).  
**Google login** stays on your Express API; **Revolut data** can be stored as an **encrypted snapshot** in Supabase (see `docs/PERFORMANCE_CACHE.md`).

---

## 1. Run migrations in Supabase

Open your project → **SQL Editor** → run each file **in order**:

| Order | File |
|-------|------|
| 1 | `supabase/migrations/00001_profiles.sql` |
| 2 | `supabase/migrations/00002_performance.sql` |
| 3 | `supabase/migrations/00003_dashboard_access.sql` |
| 4 | `supabase/migrations/00004_goals_storage.sql` |
| 5 | `supabase/migrations/00005_performance_rls_by_role.sql` |
| 6 | `supabase/migrations/00009_security_hardening.sql` |
| 7 | `supabase/migrations/00010_dashboard_permissions_config.sql` |
| 8 | `supabase/migrations/00006_performance_encrypted_cache.sql` |
| 9 | `supabase/migrations/00007_employees_directory.sql` |
| 10 | `supabase/migrations/00008_employees_full_profile.sql` |
| 11 | `supabase/migrations/00011_performance_cache_chunks.sql` |
| 12 | `supabase/seed/dashboard_users.sql` (or import CSV below) |

> **00011 — required for production:** splits the encrypted cache into small rows so Supabase PostgREST (8s statement timeout) can load the snapshot without timing out.

> **Note:** Migrations 00006–00008 are numbered for historical repo order. On a fresh project, run 00009–00010 before 00006 if you prefer strict dependency order; all use `if not exists` / `add column if not exists` and are safe to run in the table order above.

---

## 2. Get API keys

**Project Settings → API**

| Key | Where | Use |
|-----|--------|-----|
| Project URL | `SUPABASE_URL` | Server `.env` |
| `service_role` | `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — access admin, never in browser |
| `anon` / publishable | `VITE_SUPABASE_ANON_KEY` | Optional future client reads |

---

## 3. Server `.env` (production)

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Existing (keep)
APP_URL=https://your-domain.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
ALLOWED_EMAIL_DOMAIN=nextventures.io
VITE_BYPASS_AUTH=false
REVOLUT_EMAIL=...
REVOLUT_TOKEN=...

# Encrypted performance cache (openssl rand -base64 32)
PERFORMANCE_DATA_ENCRYPTION_KEY=...
```

When `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, the app uses **`dashboard_users`** instead of `server/data/access.json`.

When `PERFORMANCE_DATA_ENCRYPTION_KEY` is also set, Revolut data is cached in **`performance_encrypted_cache`** (fast loads; see `docs/PERFORMANCE_CACHE.md`).

Check: `GET /api/health` → `"accessStorage": "supabase"`.

---

## 4. Add users (no file editing)

**After** migrations + env:

```bash
# From access.json (one-time)
npm run access:migrate-supabase

# Or CSV (same as before)
npm run access:import -- server/data/users.csv
```

**Or** log in as admin → **Admin → Access** → add / bulk CSV (writes to Supabase).

---

## 5. Google OAuth (unchanged)

Still configure in **Google Cloud**, not Supabase Auth (for now):

- Redirect: `https://YOUR-DOMAIN/api/auth/google/callback`
- `APP_URL=https://YOUR-DOMAIN`

Supabase Auth + Google is optional later; current flow uses Express sessions.

---

## 6. Hosting

Production: **Vercel** serves the UI and API; **Supabase** holds all persistent data. See [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md).

Local dev: `npm run dev` (Vite + local API). Optional self-hosted: `npm run build:node && npm start`.

Do **not** commit `SUPABASE_SERVICE_ROLE_KEY` to git.

---

## 7. Tables created

| Table | Purpose |
|-------|---------|
| `dashboard_users` | Email, role, employee_id — **who can log in** |
| `performance_encrypted_cache` | Encrypted Revolut performance snapshot (API reads this first) |
| `employees` | Revolut People directory snapshot (612+ rows after sync) |
| `employees_sync_state` | Latest employee sync metadata |
| `goals_imports` | Shared goals CSV (latest upload; API writes with service role) |
| `dashboard_permissions_config` | Role/page matrix from Admin → User management |
| `performance_records` | Legacy plaintext schema (unused by API; prefer encrypted cache) |
| `profiles` | Optional link to Supabase Auth users |
| `saved_metric_views` | Per-user saved explore views |

---

## 8. Go-live checklist

- [ ] All migrations through `00010_dashboard_permissions_config.sql` run in SQL Editor  
- [ ] `PERFORMANCE_DATA_ENCRYPTION_KEY` set on production host  
- [ ] `npm run cache:warm` after first deploy (or when Revolut data changes)  
- [ ] Seed admin user (`dashboard_users`)  
- [ ] `SUPABASE_*` set on production host  
- [ ] `APP_URL` + Google redirect = production domain  
- [ ] `VITE_BYPASS_AUTH=false` and **rebuild** frontend  
- [ ] `/api/health` shows `supabase: true`, `accessStorage: supabase`  
- [ ] Test Google login + Admin → Access add user  
- [ ] `npm run cache:warm` on server for Revolut data  
