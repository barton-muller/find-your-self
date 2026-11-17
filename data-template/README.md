# My trip data

This repo holds one trip for the [Go Find Yourself](https://github.com/barton-muller/find-your-self) planner app. The whole trip is one file, `plan.json`.

The app saves to this repo when you change something, and reads from it when you open the app. You can also edit the trip here, or ask an AI agent to do it. The agent rules are in `AGENTS.md`.

## Files
- `plan.json`: the trip. Stops, transport between them, to-dos. It starts as the example trip from the app. Replace it with your own in the app, or let an agent do it.
- `DECISIONS.md`: your preferences, constraints and the reasons behind the route. Agents read this before they change anything. Keep it up to date.
- `AGENTS.md`: rules for AI agents that edit this repo. `CLAUDE.md` points to the same file.
- `scripts/plan.py`: checks the plan and prints a dated summary of every route option.

```
python3 scripts/plan.py check      # validate the plan
python3 scripts/plan.py summary    # dates for every fork combination
```

## Keep this repo private
`plan.json` has your dates, places and booking notes. Do not make it public.

Setup steps for the app side (token, sync settings) are in the [sync guide](https://github.com/barton-muller/find-your-self/blob/main/docs/SYNC-AND-AI.md).
