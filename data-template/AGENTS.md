# AGENTS.md (trip data repo)

`CLAUDE.md` is a symlink to this file.

This repo is the data for a trip planned in the Go Find Yourself app (https://github.com/barton-muller/find-your-self). `plan.json` is the single source of truth. The app reads and writes it on `main` through the GitHub Contents API. Read `DECISIONS.md` first. It holds the traveller's preferences, constraints, route decisions and verified transport facts. Update it when a decision changes.

## Editing rules
1. Run `git pull --ff-only origin main` first. The app commits to `main` ("Update trip plan"), so a local copy goes stale quickly. Never write `plan.json` from an old copy.
2. Edit through `scripts/plan.py`, not by hand-editing JSON. `save()` refuses invalid plans, hard deletes, and any changed record whose `updatedAt` was not bumped.
3. Run `python3 scripts/plan.py summary` and look at every branch before pushing.
4. Commit normally and push to `main`. The app picks the change up on its next sync. Never force-push or rewrite history.
5. Say in your reply what changed and which fork is active.

```python
import sys; sys.path.insert(0, 'scripts')
from plan import *
p, orig = load()
stop(p, 'hanoi', name='Hanoi', nights=4, lat=21.0285, lng=105.8542)   # create or update, bumps updatedAt
leg(p, 'hanoi-nb', 'hanoi', 'nb', [opt('o1', 'Train', '2h', '~EUR 8', 'notes')], 'o1')
kill_leg(p, 'old-leg'); kill_stop(p, 'old-stop')                      # tombstones
p['stops']['fork-stop']['activeOut'] = 'hanoi-nb'; p['stops']['fork-stop']['updatedAt'] = now()
save(p, orig)
```

## Data model
- `plan`: `v:1`, `start`/`end` (YYYY-MM-DD), `startId`, `stops{}`, `legs{}`, `todos{}`, `metaUpdatedAt`.
- `stop`: `id` (same as its key), `name`, `lat`/`lng`, `nights`, `notes`, `days[]` (free text per day), `activeOut` (chosen outgoing leg at a fork), `country`, `accom`, `accomBooked`, `updatedAt`, `deleted`.
- `leg`: `id`, `from`, `to`, `options[]`, `chosen` (option id), `updatedAt`, `deleted`. An option has `id`, `mode`, `duration`, `cost`, `notes`, `overnight`, `extraDays`, `booked`.
- A stop with more than one live outgoing leg is a fork. `activeOut` picks one. A stop with more than one incoming leg is a merge. The same real place on two branches is two stops (own id, same name and coordinates). A stop cannot sit twice on one path.
- Dates come from walking the active path: `arrive[next] = arrive + nights + chosen.extraDays`. An overnight leg uses the last night of the stop it leaves, so it adds no day.
- Deletes are tombstones (`deleted: true`), never removals. The app merges per record and the newest `updatedAt` (epoch milliseconds) wins. Bump `updatedAt` to now on anything you change.
- A live leg must not point at a deleted stop. The validator checks this.

## Conventions
- Keep prices rough, in one currency, and mark them "est" when you did not source them. Write durations as door-to-door text such as `~3.5-4.5h`. Note the time zone when a train crosses one.
- Notes carry the practical detail: departure times, booking window, what to check. Keep it free text.
- Use short readable ids (`hanoi`, `hanoi-nb`) that are unique across the file.
- Only set `booked` or `accomBooked` when the user says so.
