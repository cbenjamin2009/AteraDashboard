# Atera Dashboard

A local-first Remix dashboard tailored for wall displays and NOC TVs. It surfaces live ticket KPIs from the Atera public API so you can keep an eye on operational load without opening the full portal.

## Features

- Server-side loaders keep your `ATERA_API_KEY` off the client.
- KPI cards cover open totals, opened/closed this month, new today, pending queue, average open age (30d), SLA-at-risk counts, and live critical alert totals.
- Technician workload list, status breakdown, 7-day opened vs closed trend, customer volume leaderboard, and the oldest-open ticket table keep priorities obvious.
- Auto-refresh every 60 seconds plus lightweight in-memory caching to avoid hammering the API.
- Zero external services—run and host anywhere Node 18+ is available.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   ```bash
   cp .env.example .env
   # then edit .env and set ATERA_API_KEY
   ```
3. **Run the dev server**
   ```bash
   npm run dev
   ```
   Remix will print a local URL (default `http://localhost:5173`). Put the page in full-screen on your display.

### Production build

```bash
npm run build
npm start
```

## Configuration Notes

- **API access**: The app uses the `/api/v3/tickets`, `/api/v3/tickets/lastmodified`, and `/api/v3/alerts` endpoints with the `X-API-KEY` header described in the [Atera API docs](https://support.atera.com/hc/en-us/articles/219083397-APIs).
- **Environment variables**: Only `ATERA_API_KEY` is required today, but `app/utils/env.server.ts` centralizes access so you can safely add more later.
- **Caching**: `app/utils/atera.server.ts` includes a small memory cache (30s TTL) to shield the API from rapid refreshes. Adjust the constants there if you need faster/slower polling or higher page limits.
- **Auto refresh**: The root route (`app/routes/_index.tsx`) revalidates once a minute while the page is visible. If you need a different cadence, update `REFRESH_INTERVAL_MS` in that file.

## Next Ideas

- Add filters for specific customers or queues (most parameters are already patched into the helper functions).
- Layer in alerting (e.g., browser notifications when open count crosses a threshold).
- Expand the layout with other Atera datasets such as agents, automation jobs, or patch posture.

Feel free to tailor the styling in `app/styles/app.css` to match your office branding.
