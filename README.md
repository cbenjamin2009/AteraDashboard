# Atera Dashboard

A local-first Remix dashboard tailored for wall displays and NOC TVs. It surfaces live ticket KPIs from the Atera public API so you can keep an eye on operational load without opening the full portal.

## Features

- Server-side loaders keep your `ATERA_API_KEY` off the client.
- KPI cards cover open totals, opened/closed this month, new today, pending queue, average open age (30d), SLA-at-risk counts, and live critical alert totals.
- Technician workload list, status breakdown, 7-day opened vs closed trend (with spark bars), customer volume leaderboard, and the oldest-open ticket table keep priorities obvious.
- Auto-refresh interval, stale-data warning, and closed/pending keyword lists are configurable via `.env`.
- Status banners surface refresh progress or stale data so you know when the API is unhappy.
- Zero external services—run and host anywhere Node 18+ is available.

## Screenshot
<img width="600" height="300" alt="image" src="https://github.com/user-attachments/assets/04d1a72b-9cff-4a0e-9337-91ee41c4bc7a" />


## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   ```bash
   cp .env.example .env
   # then edit .env and set ATERA_API_KEY (plus any optional overrides)
   ```
3. **Run the dev server**
   ```bash
   npm run dev
   ```
   Remix will print a local URL (default `http://localhost:5173`). Put the page in full-screen on your display.

### Production build / run

```bash
npm run start:prod
```

## Configuration Notes

- **API access**: The app uses the `/api/v3/tickets`, `/api/v3/tickets/lastmodified`, and `/api/v3/alerts` endpoints with the `X-API-KEY` header described in the [Atera API docs](https://support.atera.com/hc/en-us/articles/219083397-APIs).
- **Environment variables**:
  - `ATERA_API_KEY` *(required)* – your tenant key.
  - `DASH_REFRESH_INTERVAL_MS` – client auto-refresh cadence (default `60000`).
  - `DASH_STALE_AFTER_MS` – when to banner stale data (default `300000`).
  - `DASH_PENDING_KEYWORDS` / `DASH_CLOSED_KEYWORDS` – comma lists that control which ticket statuses roll into the pending and open buckets.
- **Caching**: `app/utils/atera.server.ts` includes a small memory cache (30s TTL) to shield the API from rapid refreshes. Adjust the constants there if you need faster/slower polling or higher page limits.
- **Deployment helpers**: Use the included `Procfile` on Heroku-style hosts or point PM2/systemd at `npm run start:prod`.

## Testing & verification

```bash
npm run typecheck   # TypeScript
npm run test        # Vitest suite for metric helpers
npm run check       # Combined convenience task
```

## Next Ideas

- Add filters for specific customers or queues (most parameters are already patched into the helper functions).
- Layer in alerting (e.g., browser notifications when open count crosses a threshold).
- Expand the layout with other Atera datasets such as agents, automation jobs, or patch posture.

Feel free to tailor the styling in `app/styles/app.css` to match your office branding.
