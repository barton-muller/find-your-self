import { now } from './model';
import type { Plan } from './types';

type Kind = 'stops' | 'legs' | 'todos';
const KINDS: Kind[] = ['stops', 'legs', 'todos'];

interface Item {
  kind: Kind;
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before: any;
}
interface Meta { start: string; end: string; startId: string }
export interface Entry {
  items: Item[];
  meta?: Meta;
  t: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const norm = (o: any) => (o === undefined ? '' : JSON.stringify({ ...o, updatedAt: 0 }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bucket = (p: Plan, k: Kind): Record<string, any> => (p[k] ?? {}) as Record<string, any>;

export function diffEntry(prev: Plan, next: Plan): Entry | null {
  const items: Item[] = [];
  for (const kind of KINDS) {
    const a = bucket(prev, kind);
    const b = bucket(next, kind);
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (norm(a[id]) !== norm(b[id])) items.push({ kind, id, before: a[id] });
    }
  }
  const metaChanged = prev.start !== next.start || prev.end !== next.end || prev.startId !== next.startId;
  if (!items.length && !metaChanged) return null;
  return {
    items,
    meta: metaChanged ? { start: prev.start, end: prev.end, startId: prev.startId } : undefined,
    t: Date.now(),
  };
}

export const sameTargets = (a: Entry, b: Entry) =>
  !a.meta && !b.meta && a.items.length === b.items.length && a.items.every((x, i) => x.kind === b.items[i].kind && x.id === b.items[i].id);

export function applyEntry(plan: Plan, e: Entry): { plan: Plan; inverse: Entry } {
  const out = structuredClone(plan);
  const t = now();
  const inv: Entry = { items: [], t: Date.now() };
  for (const it of e.items) {
    const cur = bucket(out, it.kind)[it.id];
    if (!cur && !it.before) continue;
    inv.items.push({ kind: it.kind, id: it.id, before: cur ? structuredClone(cur) : undefined });
    out[it.kind] ??= {};
    bucket(out, it.kind)[it.id] = it.before
      ? { ...structuredClone(it.before), updatedAt: t }
      : { ...cur, deleted: true, updatedAt: t };
  }
  if (e.meta) {
    inv.meta = { start: out.start, end: out.end, startId: out.startId };
    Object.assign(out, e.meta);
    out.metaUpdatedAt = t;
  }
  return { plan: out, inverse: inv };
}
