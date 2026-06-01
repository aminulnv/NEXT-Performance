# Google login and access control

## Overview

- **Sign in:** Google OAuth (company email)
- **Who can log in:** emails listed in `server/data/access.json` (or `AUTH_BOOTSTRAP_ADMINS` on first login)
- **What they see:** role-based page access in `src/config/permissions.json`
- **Data filtering:** managers only see direct reports; executives get redacted payloads

## 1. Google Cloud setup

1. [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. **APIs & Services → OAuth consent screen** → Internal (Workspace) if available.
3. **Credentials → Create OAuth client ID → Web application**
4. **Authorized redirect URIs** (add every host users open in the browser):
   - `http://localhost:5173/api/auth/google/callback` (local dev)
   - `https://your-project.vercel.app/api/auth/google/callback` (production)
5. Copy **Client ID** and **Client secret**.

## 2. Environment variables

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=long-random-string-min-32-chars
APP_URL=http://localhost:5173
ALLOWED_EMAIL_DOMAIN=yourcompany.com
AUTH_BOOTSTRAP_ADMINS=you@yourcompany.com

# Turn off dev bypass to enable auth
VITE_BYPASS_AUTH=false
```

Rebuild the frontend after changing `VITE_BYPASS_AUTH`.

## 3. Add users (including bulk)

### Option A — CSV import (no login needed)

Create a CSV from `server/data/access-users.example.csv`:

```csv
email,role,employee_id,name
person@nextventures.io,manager,12345,Jane Manager
other@nextventures.io,hr,,HR User
```

Run:

```bash
npm run access:import -- server/data/your-users.csv
```

This updates `server/data/access.json`. Restart is not required.

### Option B — After you are admin (UI)

**Admin → Access → Upload users CSV** (same column format).

### Option C — Edit JSON by hand

Edit `server/data/access.json`:

```json
{
  "users": {
    "you@nextventures.io": { "role": "admin", "name": "You" }
  }
}
```

## 4. First admin

- Set `AUTH_BOOTSTRAP_ADMINS` to your email, **or**
- Add users in **Admin → Access** (requires an existing admin session or bootstrap).

## 5. Roles

| Role | Typical use |
|------|-------------|
| `admin` | Full access + user management |
| `hr` | Full analytics (no user management) |
| `manager` | Team-only performance data |
| `executive` | Home, departments, explore (summary) |

**Roles & pages:** Administrators create roles and edit page access in **Admin → User management**. Custom roles get a role id (used in CSV), display label, and **performance data** scope (all data, direct reports only, or summary/redacted). Saves to Supabase `dashboard_permissions_config` when configured, otherwise `src/config/permissions.json` on the server. Restart the API after changing `.env` so it picks up Supabase.

## 6. Manager team filter

Managers with **team** data access see everyone in their **reporting tree** (direct and indirect reports), built from line-manager links in cached performance data. Example: if Abhi reports to Fahim and Aminul/Saif report to Abhi, Fahim sees all three.

Matching uses the manager’s `employeeId` (from Revolut sync) or their Google email mapped to an employee in the cache. Ensure managers have a correct Revolut ID via **Sync** in User management.

**Revolut employee ID** is resolved automatically from cached People data when you add or save a user (same email as Revolut). Run `npm run cache:warm` after deploy so lookups work. IDs are only needed when email in Google does not match Revolut.

## 7. Local development

```bash
npm run dev
```

Vite proxies `/api` to the Express server; cookies work on `localhost:5173`.

With `VITE_BYPASS_AUTH=true`, auth is disabled and you get admin access (dev only).
