# Frontend — Live Event Intelligence dashboard

Next.js 15 (App Router) + TypeScript. A thin UI over the backend API — it holds no
business logic; it fetches `/api/*` and renders.

## Run

```bash
npm install
copy .env.local.example .env.local    # point NEXT_PUBLIC_API_BASE at the backend
npm run dev                           # http://localhost:3000
```

The backend must be running (default `http://localhost:8000`) and must allow this
origin via CORS.

## Structure

```
app/
  layout.tsx              fonts, theme no-flash script, sidebar + taskbar shell
  providers.tsx           theme, refresh-tick, priority-filter contexts + useApi/useDone hooks
  globals.css             all styling (CSS variables drive light/dark + the blue accent)
  page.tsx                home: situation brief, gauges, feed, action center
  view/[domain]/page.tsx  one topic (market / policy / disaster / health / supply chain)
  insights/page.tsx       the seven analytics charts
  event/[key]/page.tsx    one event's full breakdown + related
  action/[key]/page.tsx   every event behind one action
components/
  Sidebar.tsx  Taskbar.tsx  EventCard.tsx  ActionCenter.tsx  icons.tsx
lib/
  api.ts      fetch wrapper (NEXT_PUBLIC_API_BASE)
  types.ts    the API response shapes
  ui.ts       label maps + small formatters
```

## Data flow

- `useApi<T>(path)` fetches a JSON endpoint, refetches every 60s and whenever the
  **Refresh now** button bumps the shared refresh tick.
- Theme (light/dark) and the priority filter (Act / Worth a look / Keep watch) live
  in React context so the sidebar and the feed stay in sync.
- Routing uses real paths (`/event/…`, `/view/…`) so back/forward and shareable
  URLs work.

## Build

```bash
npm run build && npm start
```

Set `NEXT_PUBLIC_API_BASE` to the deployed backend URL for production.
