# NEXT-Performance — Platform intake

Internal HR analytics dashboard for **Revolut People** performance data, goals tracking, and organization analytics.

| Field | Value |
|-------|--------|
| **App name** | NEXT-Performance (Performance Dashboard) |
| **Production URL** | `https://performance.nextventures.io` |
| **Repository** | `https://gitlab.nextventures.io/qpt/next-performance` (branch `main`) |
| **Pre-production URL** | `https://next-performance-beta.vercel.app` |
| **Business owner** | Angie Ng Yun Ni (angie.yunni@nextventures.io), Associate Director, Performance & Total Rewards, People & Culture |
| **Technical contact** | Aminul Islam (aminul.islam@nextventures.io) |
| **Security reference** | `https://sso.fundednext.com/docs` |

---

## 1. Purpose & users

**What it does**

- Dashboard for performance review grades, scorecards, and review cycles
- Goals CSV import and program monitoring analytics
- Organization views (people, departments)
- Role-based access: admin, HR, HRBP (department-scoped), manager (direct reports), executive (redacted)

**Who uses it**

| Metric | Value |
|--------|-------|
| Active users | 30–50 internal (HR, People Ops, managers, executives) |
| Traffic | Low–moderate; read-heavy dashboard |
| Peak load | Background Revolut sync + occasional CSV uploads |
| Availability | Business hours; not customer-facing |

**External dependency**

- **Revolut People API** — server-side only (`REVOLUT_EMAIL`, `REVOLUT_TOKEN` in Secrets Manager)

---

## 2. Data sensitivity & PII

**Classification:** Confidential internal HR data.

| Data type | Examples | Storage |
|-----------|----------|---------|
| Identity | Name, email, employee ID, department | PostgreSQL |
| Performance | Final grades, scorecards, review cycles | PostgreSQL (encrypted cache) |
| Goals | Imported CSV rows (owner email, metrics) | PostgreSQL |
| Auth | Google profile, session cookie | Encrypted HTTP-only cookie |
| Audit | Login, admin actions, data ops | PostgreSQL `audit_log` |

**Not stored:** CVs, customer data, payment data. No S3/file bucket required.

**Encryption**

- Performance snapshot encrypted with **AES-256-GCM** before DB write (`PERFORMANCE_DATA_ENCRYPTION_KEY`)
- RDS: encrypted at rest, private subnet (platform-managed)
- No secrets in git (gitleaks in CI)

**Retention & deletion**

| Item | Policy |
|------|--------|
| Performance cache | Refreshed from Revolut; retained while employees are active and per standard HR archive period |
| Goals imports | Latest upload retained; prior rows superseded on re-import |
| User access | Removed via Admin → Access or DB delete |
| Full purge | On request via Angie Ng Yun Ni (People & Culture) and DevOps |

**Access control**

- Google sign-in restricted to `@nextventures.io`
- Role + page permissions in DB
- Managers see direct reports only; HRBP scoped to assigned departments
- Executives receive redacted payloads

---

## 3. Architecture & runtime

```
Browser → Cloudflare → ECS/EKS (Node container) → PostgreSQL
                              ↓
                    Revolut People API (outbound)
```

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite 6 |
| Backend | Node.js 24, Express 4 |
| Auth | Google OAuth 2.0 (Workspace) — direct, **no Cognito** (same as Caliper post-cutover) |
| Database | PostgreSQL 15+ |
| Container | Multi-stage `Dockerfile` in repo root |
| Process | Single Node process serves API + static SPA |

**Stateless:** Yes for production.

- No required local disk in multi-instance deployments
- Config via environment variables / Secrets Manager
- Sessions in signed, encrypted cookies (`cookie-session`)
- In-memory cache is per-instance only; authoritative data in PostgreSQL

**Database note:** Migrations are plain PostgreSQL SQL in `supabase/migrations/`. The app currently reads/writes via `@supabase/supabase-js` (PostgREST). For AWS RDS, the platform should either:

1. Provide a PostgREST (or Supabase-compatible) endpoint in front of RDS, **or**
2. Schedule a small adapter change to use direct `pg` before cutover

SQL schema is portable; only the client transport layer is Supabase-specific today.

---

## 4. Authentication

| Setting | Production value |
|---------|------------------|
| Provider | Google Sign-In (Workspace / corporate IdP) |
| Allowed domain | `@nextventures.io` |
| OAuth callback | `https://performance.nextventures.io/api/auth/google/callback` |
| Sign-out | `GET /api/auth/logout` → redirect to `/login` |
| Session TTL | 24 hours (override via `SESSION_MAX_AGE_MS`) |
| CSRF | OAuth `state` parameter validated on callback |

**Google Cloud Console**

- OAuth client type: Web application
- Authorized redirect URI: production callback URL above
- Consent screen: Internal (Google Workspace)

Platform injects `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — never committed to git.

---

## 5. AWS / platform resources requested

Platform provisions and injects credentials via Secrets Manager / CI — **do not email secrets**.

| Resource | Required | Notes |
|----------|----------|-------|
| **RDS PostgreSQL** | Yes | Private subnet, encrypted, backups enabled |
| **ECS/EKS service** | Yes | 1+ tasks; health check `GET /api/health` |
| **Cloudflare DNS** | Yes | `performance.nextventures.io` |
| **GitLab CI/CD** | Yes | Same pattern as Caliper (`gitlab.nextventures.io/qpt/caliper-cv-screening`) |
| **Secrets Manager** | Yes | See env var list in `DEPLOYMENT.md` |
| **Cron / EventBridge** | Yes | Daily cache warm — see below |
| **S3** | No | No file uploads |
| **Cognito** | No | Google OAuth direct |

**Scheduled job**

| Schedule | Endpoint | Auth |
|----------|----------|------|
| `0 6 * * *` (06:00 UTC daily) | `GET /api/cron/warm-cache` | `Authorization: Bearer $CRON_SECRET` |

---

## 6. Security & compliance

| Control | Status |
|---------|--------|
| No secrets in repository | CI gitleaks scan |
| Production auth bypass disabled | Enforced at build + runtime |
| Rate limiting | Auth, API, CSV upload, force refresh |
| Security headers | Helmet |
| CORS | Explicit allowlist (no `*.vercel.app` wildcard in prod) |
| Error responses | Generic 500s in production |
| Audit logging | `audit_log` table |
| RLS | Deny-by-default policies on service-role tables |
| OAuth CSRF | State token on login flow |
| Dependency audit | CI: `npm audit --omit=dev --audit-level=high` |

Happy to walk through repo or run a security review before go-live.

---

## 7. Environments & promotion

| Environment | Purpose | URL |
|-------------|---------|-----|
| Pre-production | Vercel staging | `https://next-performance-beta.vercel.app` |
| Production | Company AWS | `https://performance.nextventures.io` |

**Promotion flow:** GitLab MR → review → merge to `main` → pipeline build + deploy.

---

## 8. Observability & cost

**Health checks**

| Endpoint | Access | Response |
|----------|--------|----------|
| `GET /api/health` | Public (load balancer) | `{ "ok": true }` |
| `GET /api/health/detail` | Admin session only | Storage backends, cache status |

**Logging:** stdout/stderr from container; structured audit events in DB.

**Sizing:** Single `db.t4g.small` RDS instance, 2 ECS tasks at 1 vCPU / 512 MiB each, minimal outbound Revolut API traffic.

---

## 9. Database migrations

Run in order against PostgreSQL (SQL Editor or migration tool):

1. `00001_profiles.sql`
2. `00002_performance.sql`
3. `00003_dashboard_access.sql`
4. `00004_goals_storage.sql`
5. `00005_performance_rls_by_role.sql`
6. `00006_performance_encrypted_cache.sql`
7. `00007_employees_directory.sql`
8. `00008_employees_full_profile.sql`
9. `00009_security_hardening.sql`
10. `00010_dashboard_permissions_config.sql`
11. `00011_performance_cache_chunks.sql`
12. `00012_hrbp_role_and_permissions.sql`
13. `00013_dashboard_user_scoped_departments.sql`
14. `00014_audit_log.sql`
15. `00015_rls_auto_enable_lockdown.sql`
16. `00016_service_role_only_rls_policies.sql`

Seed file: `supabase/seed/dashboard_users.sql`

Detailed setup: `docs/SUPABASE_GO_LIVE.md` (concepts apply to any PostgreSQL host).

---

## 10. Go-live checklist

- [ ] Code pushed to GitLab (`gitlab.nextventures.io/qpt/next-performance`); personal GitHub archived
- [ ] All migrations applied to RDS
- [ ] Secrets injected (no plaintext in repo or email)
- [ ] `APP_URL=https://performance.nextventures.io`
- [ ] Google OAuth redirect URI registered
- [ ] `VITE_BYPASS_AUTH=false` at **image build** time
- [ ] `PERFORMANCE_DATA_ENCRYPTION_KEY` generated once (`openssl rand -base64 32`)
- [ ] Admin user `aminul.islam@nextventures.io` in `dashboard_users`
- [ ] Initial cache warm: `npm run cache:warm` or cron endpoint
- [ ] `/api/health` returns 200 from load balancer
- [ ] `/api/health/detail` (admin) shows database connected
- [ ] Google login + role-scoped data verified
- [ ] Daily cron registered

---

## 11. Related docs

| Doc | Purpose |
|-----|---------|
| `DEPLOYMENT.md` | Build, run, Docker, env vars |
| `docs/AUTH.md` | Google login & access control |
| `docs/DEPLOY_VERCEL.md` | Current Vercel hosting (reference) |
| `docs/SUPABASE_GO_LIVE.md` | Database setup & migrations |
| `docs/PERFORMANCE_CACHE.md` | Encrypted cache model |
