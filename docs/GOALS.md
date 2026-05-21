# Goals data (CSV import)

Revolut People's **Goals** feature is not available on the same external API used for final grades, timeline items, and scorecards (`/performance/*`). The supported way to get goals out of Revolut is **CSV export** from the Goals UI.

Goals data is shown **only after you upload** that CSV in the dashboard (Goals or Analytics → Monitoring). The server does not read `data-exports/` or any other path on disk.

## How to load goals

1. In Revolut People: **Goals → Export** (CSV).
2. Open **Goals** or **Analytics → Monitoring**.
3. Choose the CSV file. The server parses it and stores the result for everyone:
   - **Production (Supabase configured):** `goals_imports` — each upload replaces the shared row; all users and API instances see the same data.
   - **Local without Supabase:** `server/.cache/goals.json` on that machine only.

Use **Refresh** to re-fetch the last upload without selecting the file again.

## Joining to performance data

Goals are linked to people when the CSV includes an **Employee ID** column (same IDs as `/employees` and scorecard exports). The parser also recognizes common header names (`Reviewed Employee ID`, `Employee`, `Cycle Name`, etc.).

If your export only has names, goals still appear on the Goals page but may not show on **Person** detail until IDs are present.

## Automation (n8n / scheduled refresh)

Because there is no Goals API, push fresh exports via **`POST /api/goals`** with the CSV body (`Content-Type: text/csv`). Do not rely on copying files into `data-exports/`.

## Program monitoring

Open **Analytics → Monitoring** for the six indicators from your HoD deck:

- Goal submission rate (individual employee goals; Day 15 / 30 flags from calendar quarter dropdown)
- Goal approval rate (pending vs approved)
- Progress update rate (current value / progress movement)
- Check-in completion — prior-quarter employee goals must be **Complete** in the export by **Day 15** of the selected quarter (e.g. Q1 goals due by Day 15 of Q2)
- Rating distribution vs 5-15-60-15-5 (from synced performance scorecards)
- Developing/unsatisfactory performers list for HRBP outreach

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/goals` | Last uploaded goals (empty until first upload) |
| `POST` | `/api/goals` | Body: raw CSV (`Content-Type: text/csv`) |

Performance records remain on `GET /api/performance-records` (live Revolut API).

## Tuning column mapping

If headers differ from defaults, edit `COLUMN_ALIASES` in `server/parseGoalsCsv.mjs`. All original columns are kept in each goal's `fields` object for the UI.
