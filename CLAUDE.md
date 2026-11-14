# CLAUDE.md

Serverless trip-planner PWA (Vite 8 + React 19 + TS, no UI lib). Static site on GitHub Pages; data lives on-device (IndexedDB) and optionally syncs to a JSON file in a private GitHub repo. Built for one user planning ~7 weeks in South East Asia, used on phone and iPad.

## Commands
- `npm run dev` / `npm run build` (runs `tsc --noEmit` then `vite build`) / `npm run preview`
- No test suite. Verify UI with headless Playwright (preinstalled; `require('playwright')`): build, `vite preview --port 4173`, load `http://127.0.0.1:4173/#/plan`, block the service worker (`serviceWorkers: 'block'`), screenshot at a phone viewport (Pixel 7) and iPad. External hosts (OSM tiles, OSRM, Open-Meteo) are not reachable from the sandbox; mock them with `page.route`.
- Deploy: push to `main` triggers `.github/workflows/deploy.yml` (build + Pages). Site: https://barton-muller.github.io/find-your-self/. Develop on the session branch and push it, then also push it to `main` to deploy. If the user says "show me before push", send screenshots and do not push.

## Data model (`src/types.ts`, `src/model.ts`)
- `Plan`: `start`/`end` dates, `startId`, `stops`, `legs`, `todos` (all keyed by id). A DAG: stops = nodes, legs = transport edges.
- `Stop`: name, lat/lng, `country`, `nights`, notes, `days[]` (free-text activities per day), `activeOut` (chosen outgoing leg at a fork), `accom`/`accomBooked`.
- `Leg`: from/to, `options[]` (mode, duration, cost, notes, `overnight`, `extraDays`, `booked`), `chosen` option id.
- Fork = stop with >1 outgoing legs; exactly one is active (`activeOut`). Merge = stop with >1 incoming. Alternatives are shown but excluded from dates and totals.
- `schedule()` walks the active path from `startId`: `arrive[next] = arrive + nights + chosen.extraDays`. Off-path stops get their own earliest arrival. An overnight leg occupies the last night of the origin stop (no extra day; "hotel nights" = nights - 1).
- Every mutation goes through `useStore().update(draft => ...)` on a cloned plan. **Always bump `updatedAt`** (`touchStop`, `touchLeg`, `upsertTodo`). Deletes are tombstones (`deleted: true`), never removals, so sync and undo work.

## Persistence and sync
- IndexedDB (`idb-keyval`): `plan-v1`, `sync-cfg-v1`. localStorage: `tl-ppd2`, `tl-mode`. sessionStorage: `plan-scroll`.
- `src/sync.ts`: GitHub Contents API with a fine-grained PAT (Contents read/write on one private repo). Merge per record, newest `updatedAt` wins (`mergePlans`). GitHub *secrets* cannot be read from a client; do not suggest them.
- `src/history.ts`: undo/redo records only the records a step changed, restores them with a fresh `updatedAt` (so it syncs and never reverts other devices' edits). Rapid edits to the same records coalesce.

## UI map (`src/views`)
Tabs: Map, Timeline, Plan, To-do; Place (stop detail) and Settings via hash routes (`src/nav.ts`).
- `PlanView` (+`Today`): list, nights steppers, fork picker, reorder mode (swap with neighbour, `swapWithNext`), insert stop between, past stops collapsed.
- `Timeline`: git-graph style SVG. Time runs down; one dot per night; black line + icon = travel day; lanes for alternatives; pinch/buttons zoom; Auto colour switches to by-country only when fully zoomed out.
- `MapView`: Leaflet + OSM; `tiles.ts` prefetches overview tiles (zoom 3-6) into the `osm-tiles` cache.
- `Place`: city search (`CitySearch`: bundled `cities.ts` + Open-Meteo geocoding), notes, accommodation, per-day text, transport editor, rough estimator (`estimate.ts`: OSRM + straight-line fallback).
- `Todo`: auto items from unbooked stays/transport on the active route plus custom to-dos, soonest first, past-due hidden.

## Conventions and gotchas
- No emojis in UI; use SVG icons from `src/icons.tsx` (add paths there).
- Colours are Flexoki CSS variables in `styles.css` (`--c0..--c7` per-stop/country palette, light and dark). Don't hard-code hex in components.
- Header and tab bar are `position: fixed`; the document scrolls (not an inner container) so mobile browser chrome collapses cleanly. Safe-area insets apply only in `display-mode: standalone`. The map view locks page scroll.
- Keep it simple and mostly free-text; avoid adding required fields.
- Seed plan (`src/seed.ts`) is example data (28 Oct 2026 to 14 Dec 2026, Bangkok to Bangkok); stop ids there are stable and referenced by tests/screenshots.
- iOS can evict web storage; keep export/import and sync working.
