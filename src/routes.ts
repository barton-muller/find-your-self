import { get, set } from 'idb-keyval';
import type { Pt } from './estimate';

export type Line = [number, number][];
export type Kind = 'air' | 'rail' | 'road' | 'straight';

const KEY = 'route-cache-v1';
const RAIL_PROFILES = ['all_tracks', 'rail'];

export const kindOf = (mode: string): Kind => {
  const m = mode.toLowerCase();
  if (/(fly|flight|plane|air)/.test(m)) return 'air';
  if (/(train|rail|metro)/.test(m)) return 'rail';
  if (/(bus|coach|van|car|taxi|grab|drive|cab|tuk)/.test(m)) return 'road';
  return 'straight';
};

export const routeKey = (kind: Kind, a: Pt, b: Pt) =>
  `${kind}:${a.lat.toFixed(3)},${a.lng.toFixed(3)}>${b.lat.toFixed(3)},${b.lng.toFixed(3)}`;

export function arc(a: Pt, b: Pt, n = 32): Line {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const k = 0.18;
  const cx = (a.lng + b.lng) / 2 - dy * k;
  const cy = (a.lat + b.lat) / 2 + dx * k;
  const out: Line = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a.lat + 2 * u * t * cy + t * t * b.lat, u * u * a.lng + 2 * u * t * cx + t * t * b.lng]);
  }
  return out;
}

async function getJson(url: string): Promise<any | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const flip = (c: number[][]): Line => c.map(([x, y]) => [y, x]);

async function fetchRoad(a: Pt, b: Pt): Promise<Line | null> {
  const j = await getJson(
    `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&geometries=geojson`,
  );
  const c = j?.routes?.[0]?.geometry?.coordinates;
  return c?.length ? flip(c) : null;
}

let railProfile: string | null = null;

async function fetchRail(a: Pt, b: Pt): Promise<Line | null> {
  for (const p of railProfile ? [railProfile] : RAIL_PROFILES) {
    const j = await getJson(
      `https://routing.openrailrouting.org/route?point=${a.lat},${a.lng}&point=${b.lat},${b.lng}&profile=${p}&points_encoded=false&instructions=false`,
    );
    const c = j?.paths?.[0]?.points?.coordinates;
    if (c?.length) {
      railProfile = p;
      return flip(c);
    }
  }
  return null;
}

let cache: Promise<Record<string, Line>> | null = null;
const loadCache = (): Promise<Record<string, Line>> =>
  (cache ??= get<Record<string, Line>>(KEY).then((c): Record<string, Line> => c ?? {}).catch((): Record<string, Line> => ({})));

let chain: Promise<unknown> = Promise.resolve();
const queued = <T,>(fn: () => Promise<T>): Promise<T> => {
  const r = chain.then(fn, fn);
  chain = r.then(() => new Promise((res) => setTimeout(res, 400)), () => undefined);
  return r;
};

export async function cached(kind: Kind, a: Pt, b: Pt): Promise<Line | null> {
  if (kind === 'air') return arc(a, b);
  if (kind === 'straight') return null;
  return (await loadCache())[routeKey(kind, a, b)] ?? null;
}

export async function route(kind: Kind, a: Pt, b: Pt): Promise<Line | null> {
  const hit = await cached(kind, a, b);
  if (hit || kind === 'air' || kind === 'straight') return hit;
  const line = await queued(() => (kind === 'rail' ? fetchRail(a, b) : fetchRoad(a, b)));
  if (line) {
    const c = await loadCache();
    c[routeKey(kind, a, b)] = line;
    set(KEY, c).catch(() => {});
  }
  return line;
}
