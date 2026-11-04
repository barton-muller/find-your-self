import { addDays, diffDays } from './dates';
import type { Leg, Plan, Stop, TransportOption } from './types';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const now = () => Date.now();

export const liveStops = (p: Plan): Stop[] => Object.values(p.stops).filter((s) => !s.deleted);
export const liveLegs = (p: Plan): Leg[] =>
  Object.values(p.legs).filter((l) => !l.deleted && !p.stops[l.from]?.deleted && !p.stops[l.to]?.deleted);

export const outs = (p: Plan, id: string) => liveLegs(p).filter((l) => l.from === id);
export const ins = (p: Plan, id: string) => liveLegs(p).filter((l) => l.to === id);

export const chosenOption = (l: Leg): TransportOption | null =>
  l.options.find((o) => o.id === l.chosen) ?? l.options[0] ?? null;
export const legExtra = (l: Leg) => chosenOption(l)?.extraDays ?? 0;
export const legOvernight = (l: Leg) => !!chosenOption(l)?.overnight;

export const activeOutLeg = (p: Plan, id: string): Leg | null => {
  const o = outs(p, id);
  if (!o.length) return null;
  const s = p.stops[id];
  return o.find((l) => l.id === s.activeOut) ?? o[0];
};

export interface Schedule {
  path: string[];
  onPath: Set<string>;
  activeLegs: Set<string>;
  arrive: Record<string, number>;
}

export const schedule = (p: Plan): Schedule => {
  const path: string[] = [];
  const onPath = new Set<string>();
  const activeLegs = new Set<string>();
  const arrive: Record<string, number> = {};
  let cur: string | undefined = p.stops[p.startId] && !p.stops[p.startId].deleted ? p.startId : liveStops(p)[0]?.id;
  let t = 0;
  while (cur && !onPath.has(cur)) {
    path.push(cur);
    onPath.add(cur);
    arrive[cur] = t;
    const l = activeOutLeg(p, cur);
    if (!l) break;
    activeLegs.add(l.id);
    t += p.stops[cur].nights + legExtra(l);
    cur = l.to;
  }
  // off-path nodes: Kahn order, earliest arrival over scheduled predecessors
  const stops = liveStops(p);
  const legs = liveLegs(p);
  const indeg: Record<string, number> = {};
  stops.forEach((s) => (indeg[s.id] = 0));
  legs.forEach((l) => (indeg[l.to]++));
  const q = stops.filter((s) => indeg[s.id] === 0).map((s) => s.id);
  while (q.length) {
    const id = q.shift()!;
    for (const l of legs.filter((x) => x.from === id)) {
      if (!onPath.has(l.to) && arrive[id] !== undefined) {
        const c = arrive[id] + p.stops[id].nights + legExtra(l);
        if (arrive[l.to] === undefined || c < arrive[l.to]) arrive[l.to] = c;
      }
      if (--indeg[l.to] === 0) q.push(l.to);
    }
  }
  return { path, onPath, activeLegs, arrive };
};

export const dateOf = (p: Plan, s: Schedule, id: string): string | null =>
  s.arrive[id] === undefined ? null : addDays(p.start, s.arrive[id]);

export interface Branch {
  leg: Leg;
  stops: string[];
  merge: string | null;
  nights: number;
  delta: number | null;
  active: boolean;
}

export const branchesOf = (p: Plan, s: Schedule, forkId: string): Branch[] => {
  const fork = p.stops[forkId];
  const active = activeOutLeg(p, forkId);
  return outs(p, forkId).map((leg) => {
    let t = (s.arrive[forkId] ?? 0) + fork.nights + legExtra(leg);
    const seen = new Set<string>([forkId]);
    const list: string[] = [];
    let cur: string | null = leg.to;
    let merge: string | null = null;
    let nights = 0;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      if (ins(p, cur).length > 1) {
        merge = cur;
        break;
      }
      list.push(cur);
      nights += p.stops[cur].nights;
      const nl = activeOutLeg(p, cur);
      if (!nl) {
        cur = null;
        break;
      }
      t += p.stops[cur].nights + legExtra(nl);
      cur = nl.to;
    }
    const delta = merge && s.arrive[merge] !== undefined ? t - s.arrive[merge] : null;
    return { leg, stops: list, merge, nights, delta, active: leg.id === active?.id };
  });
};

export const lanes = (p: Plan, s: Schedule): Record<string, number> => {
  const lane: Record<string, number> = {};
  s.path.forEach((id) => (lane[id] = 0));
  let next = 1;
  const visit = (id: string, ln: number) => {
    if (lane[id] !== undefined) return;
    lane[id] = ln;
    outs(p, id).forEach((l) => visit(l.to, ln));
  };
  for (const id of s.path) {
    for (const l of outs(p, id)) {
      if (lane[l.to] === undefined) visit(l.to, next++);
    }
  }
  liveStops(p).forEach((st) => {
    if (lane[st.id] === undefined) lane[st.id] = next++;
  });
  return lane;
};

export const reachable = (p: Plan, from: string): Set<string> => {
  const seen = new Set<string>();
  const st = [from];
  while (st.length) {
    const id = st.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    outs(p, id).forEach((l) => st.push(l.to));
  }
  return seen;
};

export const totals = (p: Plan, s: Schedule) => {
  const budget = diffDays(p.start, p.end);
  const last = s.path[s.path.length - 1];
  const endDay = last ? s.arrive[last] + p.stops[last].nights : 0;
  const nights = s.path.reduce((a, id) => a + p.stops[id].nights, 0);
  return { budget, endDay, nights, over: endDay - budget };
};

// ---------- mutations (operate on a cloned draft) ----------

export const newOption = (mode = 'Bus'): TransportOption => ({
  id: uid(), mode, duration: '', cost: '', notes: '', overnight: false, extraDays: 0,
});

export const touchStop = (p: Plan, id: string) => {
  p.stops[id].updatedAt = now();
};
export const touchLeg = (p: Plan, id: string) => {
  p.legs[id].updatedAt = now();
};

export const addLeg = (p: Plan, from: string, to: string): Leg => {
  const o = newOption();
  const leg: Leg = { id: uid(), from, to, options: [o], chosen: o.id, updatedAt: now() };
  p.legs[leg.id] = leg;
  return leg;
};

export const addStop = (p: Plan, name = 'New stop', nights = 2): Stop => {
  const s: Stop = {
    id: uid(), name, lat: null, lng: null, nights, notes: '', days: [], activeOut: null, updatedAt: now(),
  };
  p.stops[s.id] = s;
  return s;
};

export const appendStop = (p: Plan, from: string): string => {
  const out = outs(p, from);
  const s = addStop(p);
  if (out.length === 1) {
    const l = p.legs[out[0].id];
    const oldTo = l.to;
    l.to = s.id;
    touchLeg(p, l.id);
    addLeg(p, s.id, oldTo);
  } else {
    addLeg(p, from, s.id);
  }
  return s.id;
};

export const addBranch = (p: Plan, from: string): string => {
  const s = addStop(p);
  addLeg(p, from, s.id);
  return s.id;
};

export const linkStops = (p: Plan, from: string, to: string) => {
  if (outs(p, from).some((l) => l.to === to)) return;
  addLeg(p, from, to);
};

export const deleteLeg = (p: Plan, id: string) => {
  p.legs[id].deleted = true;
  touchLeg(p, id);
};

export const deleteStop = (p: Plan, id: string) => {
  if (id === p.startId) return;
  const i = ins(p, id);
  const o = outs(p, id);
  if (i.length === 1 && o.length === 1) {
    const l = p.legs[i[0].id];
    l.to = o[0].to;
    touchLeg(p, l.id);
    deleteLeg(p, o[0].id);
  } else {
    [...i, ...o].forEach((l) => deleteLeg(p, l.id));
  }
  p.stops[id].deleted = true;
  touchStop(p, id);
};

export const setActiveOut = (p: Plan, from: string, legId: string) => {
  p.stops[from].activeOut = legId;
  touchStop(p, from);
};
