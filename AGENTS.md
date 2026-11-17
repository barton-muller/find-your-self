# AGENTS.md

`CLAUDE.md` is a symlink to this file, so every AI coding tool reads the same instructions.

Go Find Yourself: serverless trip-planner PWA (Vite 8 + React 19 + TS, no UI lib). Static site on GitHub Pages; data lives on-device (IndexedDB) and optionally syncs to a JSON file in a private GitHub repo. Started as one person's planner for ~7 weeks in South East Asia, used on phone and iPad, now published for anyone to use or copy. Name, tagline and links live in `src/brand.ts`.

## Commands
- `npm run dev` / `npm run build` (runs `tsc --noEmit` then `vite build`) / `npm run preview`
- No test suite. Verify UI with headless Playwright (preinstalled; `require('playwright')`): build, `vite preview --port 4173`, load `http://127.0.0.1:4173/#/plan`, block the service worker (`serviceWorkers: 'block'`), screenshot at a phone viewport (Pixel 7) and iPad. External hosts (OSM tiles, OSRM, Open-Meteo) are not reachable from the sandbox; mock them with `page.route`.
- Test with real data: load a `plan.json` (for example `data-template/trips/example-trip/plan.json`) into the app by writing it to IndexedDB (`keyval-store` / `keyval`, key `plan-v1`) via `page.evaluate`, then reload. Core modules can be bundled and run under node with esbuild; `import.meta.glob` must be stubbed (`--define:import.meta.glob=...`).
- Verify a deploy: GitHub Actions run "Deploy" on `main` succeeded. The map's attribution corner shows `build <sha>`, so the phone can confirm which build it runs.
- Deploy: push to `main` triggers `.github/workflows/deploy.yml` (build + Pages). Site: https://barton-muller.github.io/find-your-self/. **Maintainer's standing instruction for the original repo (fork owners: change this if you want review before deploy): work directly on `main` and push to `main` after every change, including small tweaks, without asking first** (standing instruction from the user; they will ask for a revert if something is wrong, so use `git revert`, never force-push). Fetch and merge `origin/main` before pushing, since other sessions also push there. Check the Deploy run afterwards. If the user says "show me before push", send screenshots and do not push.

## Data model (`src/types.ts`, `src/model.ts`)
- `Plan`: `start`/`end` dates, `startId`, `stops`, `legs`, `todos` (all keyed by id). A DAG: stops = nodes, legs = transport edges.
- `Stop`: name, lat/lng, `country`, `nights`, notes, `days[]` (free-text activities per day), `activeOut` (chosen outgoing leg at a fork), `accom`/`accomBooked`.
- `Leg`: from/to, `options[]` (mode, duration, cost, notes, `overnight`, `extraDays`, `booked`), `chosen` option id.
- Fork = stop with >1 outgoing legs; exactly one is active (`activeOut`). Merge = stop with >1 incoming. Alternatives are shown but excluded from dates and totals.
- `schedule()` walks the active path from `startId`: `arrive[next] = arrive + nights + chosen.extraDays`. Off-path stops get their own earliest arrival. An overnight leg occupies the last night of the origin stop (no extra day; "hotel nights" = nights - 1).
- Every mutation goes through `useStore().update(draft => ...)` on a cloned plan. **Always bump `updatedAt`** (`touchStop`, `touchLeg`, `upsertTodo`). Deletes are tombstones (`deleted: true`), never removals, so sync and undo work.

## Data repo
The plan can sync to a separate GitHub repo that the user owns (see `docs/SYNC-AND-AI.md`; `data-template/` is the starter). That repo has its own `AGENTS.md` with the rules for editing `plan.json` safely. This repo does not describe any one person's data repo.

## Persistence and sync
- IndexedDB (`idb-keyval`): `trips-v1` (`{active, list: [{id, name, path?, archived?}]}`), one plan per trip under `plan:<id>`, `sync-cfg-v1` (repo, token, branch; `path` is a legacy default). `plan-v1` is the pre-trips single plan; it is migrated once to a trip with id `main` and kept as a backup. localStorage: `tl-ppd2`, `tl-mode`. sessionStorage: `plan-scroll`.
- Trips (`store.tsx`, `trips.ts`): each trip syncs to its own file; `trip.path` is assigned on first sync (`trips/<slug>/plan.json`) and never changes on rename; a legacy single-trip user keeps `plan.json`. `listRemoteTrips` lists `trips/*/` and a root `plan.json`; remote-only trips are imported by fetching the file (no merge). Switching flushes the current plan first; a sync that finishes after a switch writes to its own trip's key, not the visible plan. Settings step 1 is the trip list (name, switch, archive, import, new).
- `src/sync.ts`: GitHub Contents API with a fine-grained PAT (Contents read/write on one private repo). Merge per record, newest `updatedAt` wins (`mergePlans`). GitHub *secrets* cannot be read from a client; do not suggest them.
- `src/history.ts`: undo/redo records only the records a step changed, restores them with a fresh `updatedAt` (so it syncs and never reverts other devices' edits). Rapid edits to the same records coalesce.

## UI map (`src/views`)
Plan cards also show a small weather strip right of the stop name (same data and `tl-wx` toggle). Tabs: Map, Timeline, Plan, To-do; Place (stop detail) and Settings via hash routes (`src/nav.ts`).
- `PlanView` (+`Today`): list, nights steppers, fork picker, reorder mode (swap with neighbour, `swapWithNext`), insert stop between, past stops collapsed.
- `Timeline`: git-graph style SVG. Time runs down; one dot per night; black line + icon = travel day; lanes for alternatives; pinch/buttons zoom; Auto colour switches to by-country only when fully zoomed out. Per-day weather icon (sun/cloud/rain, 1-3 drops by mm) beside each night dot, only from the Open-Meteo 15-day forecast (`dayWeather.ts`, cached in IndexedDB `wx-v2`, toggle `tl-wx`); travel icons are centred between day lines and use the same side rule as weather icons. Weather icons go right of the dot on single track, left of the main lane where a fork lane sits on its right, outward on alt lanes.
- `MapView`: Leaflet + OSM; `tiles.ts` prefetches the whole world (zoom 0-3) plus the region around the stops (zoom 4-7, as many levels as fit in 700 tiles) into the `osm-tiles` cache; flag `tiles-overview-v2` in IndexedDB stores the region signature.
  Leg lines (`routes.ts`): flights = curved arc (date-line safe); road modes = OSRM geometry, cached in IndexedDB (`route-cache-v1`), requests de-duplicated, one queue per kind, a host is skipped after 2 network failures (Retry button clears this); rail = bundled Natural Earth network (`src/data/rail/*.json`, 10 degree tiles, global, loaded per leg via `ne.ts`, shortest path over joined segments) then the hand-made station table `src/rail.ts` (add lines there where Natural Earth has gaps, e.g. Laos-China; it is also the place to add new rail lines for a new trip); otherwise straight. Cached lines are drawn first, uncached ones fetched after. Legs that share a corridor are drawn as parallel lanes (`lanes.ts`, 7 px apart, recomputed on zoom). Regenerate tiles from `ne_10m_railroads.geojson` (Natural Earth, nvkelso/natural-earth-vector) if needed. OpenRailRouting and Overpass were tried and removed (unreliable from the phone).
- `Place`: city search (`CitySearch`: bundled `cities.ts` + Open-Meteo geocoding), notes, accommodation, per-day text (days with no text are collapsed to an Add row), a Weather card (daily forecast from `dayWeather.ts`; hidden when no forecast), transport editor, rough estimator (`estimate.ts`: OSRM + straight-line fallback).
- `Settings`: brand card (Sync via GitHub, README), step 1 trip dates, step 2 sync and AI agents (with "Copy forecast for AI" line), offline map, backup, reset, and a footer with the AI note and credits. Sections use `Sec` with a `?` hint toggle and icon-first buttons. Plan reorder is a floating button bottom-left (`.fab`). Forecast copy (`weather.ts`: Open-Meteo daily forecast for every upcoming stop at its planned dates, copied as text to paste to Claude; null days at the 16-day horizon are skipped).
- `Todo`: auto items from unbooked stays/transport on the active route plus custom to-dos, soonest first, past-due hidden.

## Conventions and gotchas
- No emojis in UI; use SVG icons from `src/icons.tsx` (add paths there).
- Colours are Flexoki CSS variables in `styles.css` (`--c0..--c7` per-stop/country palette, light and dark). Don't hard-code hex in components.
- Header and tab bar are `position: fixed`; the document scrolls (not an inner container) so mobile browser chrome collapses cleanly. Safe-area insets apply only in `display-mode: standalone`. The map view locks page scroll.
- Keep it simple and mostly free-text; avoid adding required fields.
- Seed plan (`src/seed.ts`) is the example trip a new user sees: 17 days, starts 3 days after first launch, built to show a two-way fork and a three-way fork (rejoining on different days), an overnight leg, a multi-day leg, booked and unbooked items, day notes and to-dos. Stop ids there (`bkk cnx cri lpb vv nk vte udn kkc ayu bkk2`) are referenced by `scripts/screenshots.cjs`.
- Docs: `README.md` (users first, then developers), `docs/MAKE-YOUR-OWN.md`, `docs/SYNC-AND-AI.md`, `data-template/` (starter for the separate data repo, one folder per trip under `trips/`). Images in `docs/img/` come from `node scripts/screenshots.cjs` (needs Playwright and a build; weather is mocked). Rerun it after any visible UI change.
- Writing style for docs and UI text: short plain sentences, no hype words, no emojis, say what a thing does.
- PWA updates: `registerType: 'autoUpdate'`; `main.tsx` also calls `registration.update()` whenever the app returns to the foreground. If the phone shows old behaviour, compare the build stamp on the map.
- iOS can evict web storage; keep export/import and sync working.
