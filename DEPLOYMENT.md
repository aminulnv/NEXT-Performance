# NEXT-Performance — Deployment guide

How to build, run, and deploy the Performance Dashboard on company infrastructure (ECS/EKS, RDS, Cloudflare).

For intake summary (ownership, PII, resources), see **`INTAKE.md`**.

---

## 1. What gets deployed

One **Node.js container** that:

1. Serves the React SPA from `dist/` (built by Vite)
2. Handles all `/api/*` routes (Express)
3. Connects to PostgreSQL via Supabase JS client (PostgREST-compatible endpoint)
4. Calls Revolut People API for live sync (server-side credentials only)

There is no separate frontend host or serverless function layer in the Docker deployment.

---

## 2. Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js (local dev / CI build) | 24 LTS |
| Docker | 24+ |
| PostgreSQL | 15+ |
| Outbound HTTPS | Revolut People API, Google OAuth |

---

## 3. Build the Docker image

From the repository root:

```bash
docker build \
  --build-arg VITE_BYPASS_AUTH=false \
  -t next-performance:latest .
```

**Important:** `VITE_BYPASS_AUTH` is baked into the frontend at build time. Production images must use `false`. The server also rejects auth bypass in production regardless of this flag.

Run locally:

```bash
docker run --rm -p 3001:3001 --env-file .env next-performance:latest
```

Open **http://localhost:3001** (API + UI on the same port).

Container health check hits `GET /api/health` on `PORT` (default `3001`).

---

## 4. Local development (without Docker)

```bash
cp .env.example .env
npm install
npm run dev
```

- UI: http://localhost:5173 (Vite dev server)
- API: http://localhost:3001 (proxied via Vite)

Production-like local run:

```bash
npm run build:app
NODE_ENV=production VITE_BYPASS_AUTH=false node server/index.mjs
```

Serves on http://localhost:3001 with built assets from `dist/`.

---

## 5. Environment variables

Platform injects these via Secrets Manager / CI. **Never commit values to git.**

### Required (production)

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `PORT` | Container listen port (default `3001`) |
| `APP_URL` | `https://performance.nextventures.io` |
| `GOOGLE_CLIENT_ID` | Google OAuth web client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `SESSION_SECRET` | 32+ random chars for session signing |
| `ALLOWED_EMAIL_DOMAIN` | `nextventures.io` |
| `REVOLUT_EMAIL` | Revolut People API login email |
| `REVOLUT_TOKEN` | Revolut People API token |
| `SUPABASE_URL` | PostgREST-compatible API base URL for PostgreSQL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role JWT / key for server-side DB access |
| `PERFORMANCE_DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` — encrypts performance cache at rest |
| `CRON_SECRET` | Bearer token for `/api/cron/warm-cache` |

### Recommended

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSION_MAX_AGE_MS` | `86400000` (24h) | Session cookie lifetime |
| `AUTH_BOOTSTRAP_ADMINS` | `aminul.islam@nextventures.io` | Comma-separated emails granted admin on first login |
| `API_CACHE_MS` | `3600000` | In-memory cache TTL (ms) |
| `STALE_REFRESH_MS` | `21600000` | Background Revolut refresh threshold (ms) |
| `CORS_ORIGINS` | unset | Only needed if additional browser origins beyond `APP_URL` are required |

### Optional tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `REVOLUT_PAGE_DELAY_MS` | `350` | Delay between Revolut paginated requests |
| `INCLUDE_SCORECARDS` | `true` | Include scorecard data in sync |
| `INCLUDE_ALL_SCORECARDS` | `true` | Embed all scorecards per grade |
| `RATE_LIMIT_DISABLED` | — | Set only for local debugging |

### Must NOT be set in production

| Variable | Reason |
|----------|--------|
| `VITE_BYPASS_AUTH=true` | Disables login in dev only; must be `false` at build |
| `AUTH_DISABLED=true` | Bypasses auth on server |

---

## 6. Database setup

1. Create PostgreSQL database on RDS (private, encrypted).
2. Run migrations in order — see **`INTAKE.md` §9** or `docs/SUPABASE_GO_LIVE.md`.
3. Configure `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` pointing at the platform PostgREST endpoint.

**RDS cutover from Supabase Cloud:** export/import data or re-run `npm run cache:warm` after migrations and Revolut credentials are wired.

Seed first admin (SQL):

```sql
INSERT INTO dashboard_users (email, role, name, employee_id)
VALUES ('aminul.islam@nextventures.io', 'admin', 'Aminul Islam', NULL)
ON CONFLICT (email) DO NOTHING;
```

Or migrate from file:

```bash
npm run access:migrate-supabase
```

---

## 7. Google OAuth setup

1. Google Cloud Console → OAuth client (Web application).
2. **Authorized redirect URI:**
   ```
   https://performance.nextventures.io/api/auth/google/callback
   ```
3. Set `APP_URL` to the same origin (no trailing slash).
4. Set `ALLOWED_EMAIL_DOMAIN=nextventures.io`.

Auth flow endpoints:

| Route | Purpose |
|-------|---------|
| `GET /api/auth/google` | Start login |
| `GET /api/auth/google/callback` | OAuth callback |
| `GET /api/auth/me` | Current session |
| `GET /api/auth/logout` | End session |

---

## 8. Post-deploy steps

### Warm performance cache

First deploy (or after encryption key rotation):

```bash
# From a machine with env vars loaded:
npm run cache:warm
```

Or trigger via cron endpoint:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://performance.nextventures.io/api/cron/warm-cache"
```

First warm may take **1–2 minutes** (Revolut pagination).

### Verify

| Check | Expected |
|-------|----------|
| `GET /api/health` | `{ "ok": true }` |
| `GET /api/health/detail` (admin login) | `"supabase": true`, `"accessStorage": "supabase"`, `"performanceCache": "supabase-encrypted"` |
| Google login | Redirects to dashboard |
| Admin → Access | Can add users |

---

## 9. Scheduled jobs

| Job | Schedule | Endpoint | Auth header |
|-----|----------|----------|-------------|
| Cache warm | `0 6 * * *` UTC | `GET /api/cron/warm-cache` | `Authorization: Bearer $CRON_SECRET` |

On AWS, schedule via EventBridge → `GET https://performance.nextventures.io/api/cron/warm-cache` with `Authorization: Bearer $CRON_SECRET`.

---

## 10. ECS / Kubernetes notes

**Load balancer**

- Target port: `3001` (or `PORT`)
- Health check path: `/api/health`
- Expect `200` with body `{ "ok": true }`

**Proxy headers**

- App sets `trust proxy` — ensure `X-Forwarded-Proto` and `X-Forwarded-Host` are set for HTTPS OAuth redirects behind Cloudflare/ALB.

**Scaling**

- Stateless HTTP; scale horizontally if needed.
- In-memory cache is per task; PostgreSQL is source of truth.
- Avoid relying on `server/.cache/` on ephemeral disks in multi-task deployments.

**Resources**

| Resource | Value |
|----------|-------|
| CPU | 1 vCPU per task |
| Memory | 512 MiB per task |
| Tasks | 2 |

---

## 11. GitLab CI example

Minimal pipeline for `gitlab.nextventures.io/qpt/next-performance`:

```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  image: node:24-alpine
  script:
    - npm ci
    - npm run lint
    - npm test
    - npm audit --omit=dev --audit-level=high

build:
  stage: build
  script:
    - docker build --build-arg VITE_BYPASS_AUTH=false -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

deploy:
  stage: deploy
  script:
    - aws ecs update-service --cluster next-performance --service next-performance --force-new-deployment
```

Existing GitHub workflow reference: `.github/workflows/ci.yml` (lint, test, gitleaks, audit, build).

---

## 12. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| OAuth redirects to localhost | `APP_URL` wrong or proxy headers missing |
| Login works but no data | Migrations not applied or cache not warmed |
| `503` on cron | `CRON_SECRET` not set in production |
| Users reset on redeploy | `SUPABASE_*` not configured; falling back to ephemeral file storage |
| Empty goals for HRBP | Employee directory not synced — run cache warm or check `employees` table |
| `403` on all pages | User not in `dashboard_users` |

**Logs:** container stdout. Search for `[auth]`, `[cache]`, `[access]`, `[cron]`.

---

## 13. File layout (runtime)

```
/
├── dist/              # Vite build output (static SPA)
├── server/
│   ├── index.mjs      # Entry point (CMD)
│   ├── app.mjs        # Express app + routes
│   └── …              # API modules
├── supabase/
│   └── migrations/    # PostgreSQL schema (apply at deploy)
├── Dockerfile
├── INTAKE.md
└── DEPLOYMENT.md
```
