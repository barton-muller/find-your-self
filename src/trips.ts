import { addDays } from './dates';
import { addStop, now } from './model';
import type { Plan, TripMeta } from './types';

export const slug = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trip';

export const prettyName = (folder: string) => {
  const t = folder.replace(/[-_]+/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : folder;
};

export const uniquePath = (name: string, list: TripMeta[]): string => {
  const used = new Set(list.map((t) => t.path));
  let path = `trips/${slug(name)}/plan.json`;
  for (let n = 2; used.has(path); n++) path = `trips/${slug(name)}-${n}/plan.json`;
  return path;
};

export const emptyPlan = (start: string): Plan => {
  const p: Plan = { v: 1, start, end: addDays(start, 7), metaUpdatedAt: now(), startId: '', stops: {}, legs: {}, todos: {} };
  p.startId = addStop(p).id;
  return p;
};
