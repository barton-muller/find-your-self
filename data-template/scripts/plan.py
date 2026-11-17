#!/usr/bin/env python3
"""Validate, summarise and safely edit trip plans.

A repo can hold several trips: trips/<name>/plan.json (and, for older setups, plan.json in the root).
CLI:   python scripts/plan.py check [path]      # validate every plan, or one; exit 1 on errors
       python scripts/plan.py summary [path]    # check + dated walk of every branch
Edits: from plan import *  (see AGENTS.md). With several trips, pass the path to load() and save(),
       or set PLAN=trips/<name>/plan.json. save() refuses invalid plans and records that changed
       without a newer updatedAt.
"""
import copy
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def plan_files():
    files = [ROOT / 'plan.json', *sorted((ROOT / 'trips').glob('*/plan.json'))]
    return [f for f in files if f.exists()]


def resolve(path=None):
    if path is None:
        path = os.environ.get('PLAN')
    if path is None:
        files = plan_files()
        if len(files) != 1:
            raise SystemExit('Several trips here: pass the path, or set PLAN=trips/<name>/plan.json')
        return files[0]
    path = Path(path)
    return path if path.is_absolute() else ROOT / path


def now():
    return int(time.time() * 1000)


def load(path=None):
    p = json.loads(resolve(path).read_text())
    return p, copy.deepcopy(p)


def live_legs(p):
    return [l for l in p['legs'].values() if not l.get('deleted')]


def outs(p):
    o = {}
    for l in live_legs(p):
        o.setdefault(l['from'], []).append(l)
    return o


def validate(p):
    err, warn = [], []
    S, L = p['stops'], p['legs']
    if p.get('v') != 1:
        err.append('v must be 1')
    for k in ('start', 'end'):
        try:
            dt.date.fromisoformat(p[k])
        except Exception:
            err.append(f'{k} is not YYYY-MM-DD')
    if p.get('startId') not in S or S[p['startId']].get('deleted'):
        err.append('startId is missing or deleted')
    for k, s in S.items():
        if s.get('id') != k:
            err.append(f'stop {k}: id mismatch')
        if not isinstance(s.get('nights'), int) or s['nights'] < 0:
            err.append(f'stop {k}: nights must be an int >= 0')
        if not isinstance(s.get('updatedAt'), int):
            err.append(f'stop {k}: updatedAt missing')
        for c in ('lat', 'lng'):
            if s.get(c) is not None and not isinstance(s[c], (int, float)):
                err.append(f'stop {k}: {c} must be a number or null')
        if not s.get('deleted') and not s.get('name'):
            warn.append(f'stop {k}: no name')
        if not s.get('deleted') and s.get('lat') is None:
            warn.append(f'stop {k} ({s.get("name")}): no coordinates (not drawn on the map)')
    for k, l in L.items():
        if l.get('id') != k:
            err.append(f'leg {k}: id mismatch')
        if not isinstance(l.get('updatedAt'), int):
            err.append(f'leg {k}: updatedAt missing')
        if l.get('deleted'):
            continue
        for e in ('from', 'to'):
            if l[e] not in S:
                err.append(f'leg {k}: {e} {l[e]} does not exist')
            elif S[l[e]].get('deleted'):
                err.append(f'leg {k}: {e} {l[e]} ({S[l[e]]["name"]}) is deleted')
        ids = [o['id'] for o in l['options']]
        if len(ids) != len(set(ids)):
            err.append(f'leg {k}: duplicate option ids')
        if l['options'] and l.get('chosen') not in ids:
            err.append(f'leg {k}: chosen {l.get("chosen")} not in options')
        for o in l['options']:
            if not isinstance(o.get('extraDays'), int) or o['extraDays'] < 0:
                err.append(f'leg {k}/{o["id"]}: extraDays must be an int >= 0')
            if not isinstance(o.get('overnight'), bool):
                err.append(f'leg {k}/{o["id"]}: overnight must be a bool')
    O = outs(p)
    for k, ls in O.items():
        if len(ls) > 1 and not S[k].get('deleted'):
            a = S[k].get('activeOut')
            if a not in [l['id'] for l in ls]:
                warn.append(f'fork {S[k]["name"]} ({k}): activeOut {a} is not one of its legs (app picks the first)')
    # every route should end at the same stop
    ends = [k for k, s in S.items() if not s.get('deleted') and k not in O]
    if len(ends) > 1:
        for k in ends:
            warn.append(f'stop {k} ({S[k]["name"]}) is a dead end; {len(ends)} stops have no onward leg. Join every branch to the final stop')
    # cycles + reachability
    seen, stack, cyc = set(), set(), []

    def dfs(u):
        seen.add(u)
        stack.add(u)
        for l in O.get(u, []):
            v = l['to']
            if v in stack:
                cyc.append(f'{u} -> {v}')
            elif v not in seen:
                dfs(v)
        stack.discard(u)
    if p.get('startId') in S:
        dfs(p['startId'])
    for c in cyc:
        err.append(f'cycle: {c}')
    for k, s in S.items():
        if not s.get('deleted') and k not in seen:
            warn.append(f'stop {k} ({s["name"]}) is not reachable from startId')
    return err, warn


def walk(p, force=None):
    """Dated rows along the active path (force = {stop id: leg id} to override forks)."""
    S, force = p['stops'], force or {}
    O = outs(p)
    t = dt.date.fromisoformat(p['start'])
    cur, rows = p['startId'], []
    while cur:
        s = S[cur]
        rows.append((t, s['name'], s['nights']))
        ls = O.get(cur, [])
        if not ls:
            t += dt.timedelta(days=s['nights'])
            break
        a = force.get(cur) or s.get('activeOut')
        l = next((x for x in ls if x['id'] == a), ls[0])
        o = next((x for x in l['options'] if x['id'] == l.get('chosen')), None)
        t += dt.timedelta(days=s['nights'] + (o['extraDays'] if o else 0))
        cur = l['to']
    return rows, t


def branches(p):
    """Every combination of fork choices -> (label, rows, end)."""
    O = outs(p)
    forks = [(k, ls) for k, ls in O.items() if len(ls) > 1]
    combos = [{}]
    for k, ls in forks:
        combos = [dict(c, **{k: l['id']}) for c in combos for l in ls]
    out = []
    for c in combos:
        rows, end = walk(p, c)
        label = ', '.join(f'{p["stops"][k]["name"]}->{p["stops"][p["legs"][v]["to"]]["name"]}' for k, v in c.items()) or 'single path'
        out.append((label, rows, end))
    return out


def summary(p):
    for label, rows, end in branches(p):
        print(f'\n[{label}] ends {end} (plan end {p["end"]})')
        for d, n, nights in rows:
            print(f'  {d:%a %d %b}  {n} ({nights}n)')


def save(p, orig, path=None):
    """Write plan.json only if valid and every changed record has a newer updatedAt."""
    err, warn = validate(p)
    for kind in ('stops', 'legs'):
        for k, rec in p[kind].items():
            before = orig[kind].get(k)
            if before is None or rec == before:
                continue
            if rec['updatedAt'] <= before['updatedAt']:
                err.append(f'{kind[:-1]} {k} changed without a newer updatedAt')
        for k in orig[kind]:
            if k not in p[kind]:
                err.append(f'{kind[:-1]} {k} was removed; use tombstones (deleted: true)')
    for w in warn:
        print('warn:', w)
    if err:
        for e in err:
            print('ERROR:', e)
        raise SystemExit('refusing to save')
    p['metaUpdatedAt'] = max(p.get('metaUpdatedAt', 0), now())
    resolve(path).write_text(json.dumps(p, indent=1, ensure_ascii=False) + '\n')


# helpers: every one bumps updatedAt
def opt(id, mode, duration='', cost='', notes='', overnight=False, extra=0):
    return dict(id=id, mode=mode, duration=duration, cost=cost, notes=notes, overnight=overnight, extraDays=extra)


def stop(p, id, **kw):
    s = p['stops'].get(id) or dict(id=id, name='', lat=None, lng=None, nights=1, notes='', days=[], activeOut=None)
    s.update(kw)
    s['updatedAt'] = now()
    p['stops'][id] = s


def leg(p, id, frm, to, options, chosen):
    l = p['legs'].get(id) or dict(id=id)
    l.update({'from': frm, 'to': to, 'options': options, 'chosen': chosen, 'updatedAt': now()})
    l.pop('deleted', None)
    p['legs'][id] = l


def kill_stop(p, id):
    p['stops'][id].update(deleted=True, updatedAt=now())


def kill_leg(p, id):
    p['legs'][id].update(deleted=True, updatedAt=now())


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    targets = [resolve(sys.argv[2])] if len(sys.argv) > 2 else plan_files()
    if not targets:
        raise SystemExit('No plan.json found (looked in the root and in trips/*/).')
    failed = False
    for target in targets:
        print(f'== {target.relative_to(ROOT) if target.is_relative_to(ROOT) else target}')
        plan, _ = load(target)
        e, w = validate(plan)
        for x in w:
            print('warn:', x)
        for x in e:
            print('ERROR:', x)
        if cmd == 'summary':
            summary(plan)
        print(f'\n{len(e)} errors, {len(w)} warnings\n')
        failed = failed or bool(e)
    sys.exit(1 if failed else 0)
