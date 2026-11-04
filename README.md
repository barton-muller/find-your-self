# Trip planner

Serverless PWA (Vite + React + TS). Plan = DAG of stops joined by transport legs; forks are alternatives with one active route.

## Deploy
Repo Settings → Pages → Source: GitHub Actions. Merge to `main`. On iPhone/iPad: Safari → Share → Add to Home Screen.

## Sync (optional)
1. Create a **private** repo (e.g. `trip-data`) with any commit on `main`.
2. Fine-grained PAT, only that repo, Contents: read & write.
3. App → ⚙ → enter `owner/trip-data`, `plan.json`, `main`, token. The token stays on-device.

Merge is per stop/leg, newest `updatedAt` wins. Export/import JSON is under ⚙ too.

## Dev
`npm i && npm run dev`
