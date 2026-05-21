# Encrypted performance cache (Supabase)

Revolut API sync is slow (many paginated calls + rate limits). The API serves **cached** data first and only hits Revolut when the cache is missing, stale, or the user forces **Refresh**.

## Layers (fastest first)

1. **Memory** — same process, `API_CACHE_MS` (default 1 hour)
2. **Supabase** — AES-256-GCM encrypted snapshot (`performance_encrypted_cache`)
3. **Disk** — `server/.cache/performance-records.json` (fallback / local dev)
4. **Live Revolut** — background or on demand (`?refresh=1`)

## Setup

### 1. Run migration

In Supabase SQL Editor:

`supabase/migrations/00006_performance_encrypted_cache.sql`

### 2. Generate encryption key (once)

```bash
openssl rand -base64 32
```

Add to server `.env` (never commit, never prefix with `VITE_`):

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PERFORMANCE_DATA_ENCRYPTION_KEY=<paste output>
```

If you change this key, you must re-warm the cache (`npm run cache:warm`).

### 3. Warm the cache

```bash
npm run cache:warm
```

Writes encrypted data to Supabase and a local disk copy.

### 4. Verify

`GET /api/health` should include:

```json
{
  "performanceCache": "supabase-encrypted"
}
```

Dashboard loads should show `cacheStatus: "supabase"` in the API response (no Revolut wait).

## Security model

| Item | Notes |
|------|--------|
| **At rest** | Full dataset encrypted with `PERFORMANCE_DATA_ENCRYPTION_KEY` before insert |
| **In DB** | Only ciphertext; no RLS read policies (service role / server only) |
| **In browser** | Unchanged — API decrypts server-side; clients never see the key |
| **Key storage** | Host env only (Render/Vercel secrets), not in git |

Supabase admins can still see ciphertext blobs; encryption protects against DB leaks and casual access, not a compromised service role.

## Refresh behavior

- Normal page load: read Supabase/disk, optionally refresh Revolut in background if older than `STALE_REFRESH_MS`
- **Refresh** button: HR/admin only when auth is on; `?refresh=1` fetches Revolut and re-saves encrypted snapshot
