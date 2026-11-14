# Trip planner

Serverless PWA for planning a multi-week trip: where you go, how many nights, how you get between places, and what you do each day. Works on phone and iPad, installable to the home screen.

## Features
- **Plan**: stops with night steppers (dates and totals update instantly), transport options per connection (bus, train, flight, ...; overnight and multi-day), activities per day, accommodation, notes. Insert a stop between two others, reorder with arrows.
- **Forks and merges**: branch the route (e.g. two ways through Laos), pick the active one, see the date impact at the merge.
- **Timeline**: git-graph style view, a dot per night, travel days as black lines with mode icons, zoom/pinch, colour by stop or country.
- **Map**: route and stops on OpenStreetMap, current location, overview tiles cached offline.
- **Today**: current stop, today's activities, next transport.
- **To-do**: booked/not-booked checklist for stays and transport (soonest first) plus custom to-dos.
- **Search a city** by name (built-in list plus Open-Meteo geocoding); **rough travel time estimates** per connection.
- Undo/redo, export/import JSON, optional sync across devices.

## Deploy
Repo Settings > Pages > Source: GitHub Actions. Pushes to `main` build and deploy. On iPhone/iPad: Safari > Share > Add to Home Screen.

## Sync (optional)
1. Create a **private** repo (e.g. `trip-data`) with an initial commit (a README is enough).
2. Fine-grained token limited to that repo, Contents: read and write. Set an expiry beyond your trip.
3. App > gear icon > enter `owner/trip-data`, `plan.json`, `main`, token. The token stays on the device.

Merging is per stop, connection and to-do; the newest edit wins.

## Dev
`npm i && npm run dev`, `npm run build` to type-check and build. See `CLAUDE.md` for architecture and conventions.
