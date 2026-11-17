# My trip data

This repo holds your trips for the [Go Find Yourself](https://github.com/barton-muller/find-your-self) planner app. Each trip is one folder with one file, `trips/<name>/plan.json`.

The app saves to this repo when you change something, and reads from it when you open the app. A trip you start in the app gets its own folder on the first sync. You can also edit trips here, or ask an AI agent to do it. The agent rules are in `AGENTS.md`.

## Files
- `trips/<name>/plan.json`: one trip. Stops, transport between them, to-dos. `trips/example-trip` is the example trip from the app.
- `trips/<name>/DECISIONS.md`: reasons behind that trip's route, checked transport facts, open questions.
- `DECISIONS.md`: your preferences and constraints that apply to every trip.
- `AGENTS.md`: rules for AI agents that edit this repo. `CLAUDE.md` points to the same file.
- `scripts/plan.py`: checks the plans and prints a dated summary of every route option.

```
python3 scripts/plan.py check                       # validate every trip
python3 scripts/plan.py summary trips/japan/plan.json   # dates for every fork combination of one trip
```

## Sharing with others
If several people use this repo, keep a branch called `template` with just these files. The app starts each person's branch (`u/<name>`) from it. See the [friends guide](https://github.com/barton-muller/find-your-self/blob/main/docs/FRIENDS.md).

## Keep this repo private
The plans hold your dates, places and booking notes. Do not make the repo public.

Setup steps for the app side (token, sync settings) are in the [sync guide](https://github.com/barton-muller/find-your-self/blob/main/docs/SYNC-AND-AI.md).
