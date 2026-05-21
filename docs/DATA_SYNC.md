# Data source: live Revolut API (no Supabase)

The dashboard does **not** use Supabase or Google Sheets. A local Node server mirrors your n8n pipeline:

1. `POST /login` → session token  
2. `GET /employees`  
3. `GET /performance/finalGrades` (paginated)  
4. `GET /performance/timelineItems` (cycles + completion)  
5. `GET /performance/performanceScorecards` (paginated)  
6. **Flatten** → same super-table as n8n **Flatten Final Grades**

The React app calls `GET /api/performance-records` (proxied to port 3001).

## Environment (`.env`)

```env
REVOLUT_EMAIL=...
REVOLUT_TOKEN=...
API_PORT=3001
API_CACHE_MS=300000
VITE_BYPASS_AUTH=true
```

Use the **same email/token** as in `revolut-finalGrades.json` (Revolut Login node). Do **not** put these in `VITE_*` variables.

## Refresh

- **Refresh** in the UI → `?refresh=1` bypasses the in-memory cache  
- Default cache: 5 minutes (`API_CACHE_MS`)

## n8n / Google Sheets

You can keep n8n writing to Sheets for backups. The web app reads Revolut directly and does not depend on that export.

## Optional Supabase later

Migrations under `supabase/migrations/` are unused when `VITE_BYPASS_AUTH=true`. Re-enable if you want auth + DB storage again.
