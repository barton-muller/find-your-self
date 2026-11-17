# CLAUDE.md

Serverless trip-planner PWA (Vite 8 + React 19 + TS, no UI lib). Static site on GitHub Pages; data lives on-device (IndexedDB) and optionally syncs to a JSON file in a private GitHub repo. Built for one user planning ~7 weeks in South East Asia, used on phone and iPad.

## Commands
- `npm run dev` / `npm run build` (runs `tsc --noEmit` then `vite build`) / `npm run preview`
- No test suite. Verify UI with headless Playwright (preinstalled; `require('playwright')`): build, `vite preview --port 4173`, load `http://127.0.0.1:4173/#/plan`, block the service worker (`serviceWorkers: 'block'`), screenshot at a phone viewport (Pixel 7) and iPad. External hosts (OSM tiles, OSRM, Open-Meteo) are not reachable from the sandbox; mock them with `page.route`.
- Test with real data: load `findyouself-data/plan.json` into the app by writing it to IndexedDB (`keyval-store` / `keyval`, key `plan-v1`) via `page.evaluate`, then reload. Core modules can be bundled and run under node with esbuild; `import.meta.glob` must be stubbed (`--define:import.meta.glob=...`).
- Verify a deploy: GitHub Actions run "Deploy" on `main` succeeded. The map's attribution corner shows `build <sha>`, so the phone can confirm which build it runs.
- Deploy: push to `main` triggers `.github/workflows/deploy.yml` (build + Pages). Site: https://barton-muller.github.io/find-your-self/. Develop on the session branch and push it, then also push it to `main` to deploy. If the user says "show me before push", send screenshots and do not push.

## Data model (`src/types.ts`, `src/model.ts`)
- `Plan`: `start`/`end` dates, `startId`, `stops`, `legs`, `todos` (all keyed by id). A DAG: stops = nodes, legs = transport edges.
- `Stop`: name, lat/lng, `country`, `nights`, notes, `days[]` (free-text activities per day), `activeOut` (chosen outgoing leg at a fork), `accom`/`accomBooked`.
- `Leg`: from/to, `options[]` (mode, duration, cost, notes, `overnight`, `extraDays`, `booked`), `chosen` option id.
- Fork = stop with >1 outgoing legs; exactly one is active (`activeOut`). Merge = stop with >1 incoming. Alternatives are shown but excluded from dates and totals.
- `schedule()` walks the active path from `startId`: `arrive[next] = arrive + nights + chosen.extraDays`. Off-path stops get their own earliest arrival. An overnight leg occupies the last night of the origin stop (no extra day; "hotel nights" = nights - 1).
- Every mutation goes through `useStore().update(draft => ...)` on a cloned plan. **Always bump `updatedAt`** (`touchStop`, `touchLeg`, `upsertTodo`). Deletes are tombstones (`deleted: true`), never removals, so sync and undo work.

## Data repo
The live plan is `barton-muller/findyouself-data` (`plan.json` on `main`). The app syncs to it; Claude sessions edit it with `scripts/plan.py` there (validation, safe edit helpers) and keep `DECISIONS.md` current. Read its `CLAUDE.md` before touching the plan.

## Persistence and sync
- IndexedDB (`idb-keyval`): `plan-v1`, `sync-cfg-v1`. localStorage: `tl-ppd2`, `tl-mode`. sessionStorage: `plan-scroll`.
- `src/sync.ts`: GitHub Contents API with a fine-grained PAT (Contents read/write on one private repo). Merge per record, newest `updatedAt` wins (`mergePlans`). GitHub *secrets* cannot be read from a client; do not suggest them.
- `src/history.ts`: undo/redo records only the records a step changed, restores them with a fresh `updatedAt` (so it syncs and never reverts other devices' edits). Rapid edits to the same records coalesce.

## UI map (`src/views`)
Tabs: Map, Timeline, Plan, To-do; Place (stop detail) and Settings via hash routes (`src/nav.ts`).
- `PlanView` (+`Today`): list, nights steppers, fork picker, reorder mode (swap with neighbour, `swapWithNext`), insert stop between, past stops collapsed.
- `Timeline`: git-graph style SVG. Time runs down; one dot per night; black line + icon = travel day; lanes for alternatives; pinch/buttons zoom; Auto colour switches to by-country only when fully zoomed out. Per-day weather icon (sun/cloud/rain, 1-3 drops by mm) beside each night dot, only from the Open-Meteo 15-day forecast (`dayWeather.ts`, cached in IndexedDB `wx-v2`, toggle `tl-wx`); travel icons are centred between day lines.
- `MapView`: Leaflet + OSM; `tiles.ts` prefetches overview tiles (zoom 3-6) into the `osm-tiles` cache.
  Leg lines (`routes.ts`): flights = curved arc (date-line safe); road modes = OSRM geometry, cached in IndexedDB (`route-cache-v1`), requests de-duplicated, one queue per kind, a host is skipped after 2 network failures (Retry button clears this); rail = bundled Natural Earth network (`src/data/rail/*.json`, 10 degree tiles, global, loaded per leg via `ne.ts`, shortest path over joined segments) then the hand-made station table `src/rail.ts` (add lines there where Natural Earth has gaps, e.g. Laos-China; it is also the place to add new rail lines for a new trip); otherwise straight. Cached lines are drawn first, uncached ones fetched after. Legs that share a corridor are drawn as parallel lanes (`lanes.ts`, 7 px apart, recomputed on zoom). Regenerate tiles from `ne_10m_railroads.geojson` (Natural Earth, nvkelso/natural-earth-vector) if needed. OpenRailRouting and Overpass were tried and removed (unreliable from the phone).
- `Place`: city search (`CitySearch`: bundled `cities.ts` + Open-Meteo geocoding), notes, accommodation, per-day text, transport editor, rough estimator (`estimate.ts`: OSRM + straight-line fallback).
- `Settings`: trip dates, sync, offline map, backup, and "Copy forecast" (`weather.ts`: Open-Meteo daily forecast for every upcoming stop at its planned dates, copied as text to paste to Claude; null days at the 16-day horizon are skipped).
- `Todo`: auto items from unbooked stays/transport on the active route plus custom to-dos, soonest first, past-due hidden.

## Conventions and gotchas
- No emojis in UI; use SVG icons from `src/icons.tsx` (add paths there).
- Colours are Flexoki CSS variables in `styles.css` (`--c0..--c7` per-stop/country palette, light and dark). Don't hard-code hex in components.
- Header and tab bar are `position: fixed`; the document scrolls (not an inner container) so mobile browser chrome collapses cleanly. Safe-area insets apply only in `display-mode: standalone`. The map view locks page scroll.
- Keep it simple and mostly free-text; avoid adding required fields.
- Seed plan (`src/seed.ts`) is example data (28 Oct 2026 to 14 Dec 2026, Bangkok to Bangkok); stop ids there are stable and referenced by tests/screenshots.
- PWA updates: `registerType: 'autoUpdate'`; `main.tsx` also calls `registration.update()` whenever the app returns to the foreground. If the phone shows old behaviour, compare the build stamp on the map.
- iOS can evict web storage; keep export/import and sync working.
