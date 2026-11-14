import { get, set } from 'idb-keyval';
import type { Pt } from './estimate';

export type Line = [number, number][];
export type Kind = 'air' | 'rail' | 'road' | 'straight';

const KEY = 'route-cache-v1';

export const kindOf = (mode: string): Kind => {
  const m = mode.toLowerCase();
  if (/(fly|flight|plane|air)/.test(m)) return 'air';
  if (/(train|rail|metro)/.test(m)) return 'rail';
  if (/(bus|coach|van|car|taxi|grab|drive|cab|tuk)/.test(m)) return 'road';
  return 'straight';
};

export const routeKey = (kind: Kind, a: Pt, b: Pt) =>
  `${kind}:${a.lat.toFixed(3)},${a.lng.toFixed(3)}>${b.lat.toFixed(3)},${b.lng.toFixed(3)}`;

export function arc(a: Pt, b0: Pt, n = 32): Line {
  const dl = ((((b0.lng - a.lng) % 360) + 540) % 360) - 180;
  const b = { lat: b0.lat, lng: a.lng + dl };
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

export const diag: { road?: string } = {};

type Res = { json: any | null; err: string };

const hostFails: Record<string, number> = {};
const hostLast: Record<string, string> = {};
const failedAt = new Map<string, number>();
const inflight = new Map<string, Promise<Line | null>>();
const FAIL_TTL = 10 * 60 * 1000;

export const retryFailed = () => {
  for (const k of Object.keys(hostFails)) delete hostFails[k];
  for (const k of Object.keys(hostLast)) delete hostLast[k];
  failedAt.clear();
  for (const k of Object.keys(diag)) delete diag[k as keyof typeof diag];
};

async function getJson(url: string): Promise<Res> {
  const host = new URL(url).hostname;
  if ((hostFails[host] ?? 0) >= 2) return { json: null, err: `${host}: skipped after 2 failures, last: ${hostLast[host] ?? '?'}` };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (r.ok) {
      hostFails[host] = 0;
      return { json: await r.json(), err: '' };
    }
    let msg = '';
    try {
      msg = (await r.json()).message ?? '';
    } catch {
      /* no body */
    }
    if (r.status >= 500 || r.status === 429) {
      hostFails[host] = (hostFails[host] ?? 0) + 1;
      hostLast[host] = `HTTP ${r.status}`;
    }
    return { json: null, err: `${host}: HTTP ${r.status} ${msg}`.trim().slice(0, 140) };
  } catch (e) {
    hostFails[host] = (hostFails[host] ?? 0) + 1;
    if ((e as Error).name === 'AbortError') return { json: null, err: `${host}: timed out` };
    let why = 'network error';
    try {
      await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(6000) });
      why = 'blocked by CORS';
    } catch {
      /* keep */
    }
    hostLast[host] = `${why} (${(e as Error).message})`;
    return { json: null, err: `${host}: ${hostLast[host]}` };
  } finally {
    clearTimeout(t);
  }
}

const flip = (c: number[][]): Line => c.map(([x, y]) => [y, x]);

async function fetchRoad(a: Pt, b: Pt): Promise<Line | null> {
  const { json, err } = await getJson(
    `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&geometries=geojson`,
  );
  const c = json?.routes?.[0]?.geometry?.coordinates;
  if (c?.length) {
    delete diag.road;
    return flip(c);
  }
  diag.road = err || 'no route';
  return null;
}

let cache: Promise<Record<string, Line>> | null = null;
const loadCache = (): Promise<Record<string, Line>> =>
  (cache ??= get<Record<string, Line>>(KEY).then((c): Record<string, Line> => c ?? {}).catch((): Record<string, Line> => ({})));

const chains: Record<string, Promise<unknown>> = {};
const queued = <T,>(kind: string, fn: () => Promise<T>): Promise<T> => {
  const r = (chains[kind] ?? Promise.resolve()).then(fn, fn);
  chains[kind] = r.then(() => new Promise((res) => setTimeout(res, 400)), () => undefined);
  return r;
};

export async function cached(kind: Kind, a: Pt, b: Pt): Promise<Line | null> {
  if (kind === 'air') return arc(a, b);
  if (kind === 'straight' || kind === 'rail') return null;
  return (await loadCache())[routeKey(kind, a, b)] ?? null;
}

export async function route(kind: Kind, a: Pt, b: Pt): Promise<Line | null> {
  const hit = await cached(kind, a, b);
  if (hit || kind === 'air' || kind === 'straight' || kind === 'rail') return hit;
  const key = routeKey(kind, a, b);
  if (Date.now() - (failedAt.get(key) ?? 0) < FAIL_TTL) return null;
  let p = inflight.get(key);
  if (!p) {
    p = queued(kind, () => fetchRoad(a, b)).then(async (line) => {
      inflight.delete(key);
      if (line) {
        const c = await loadCache();
        c[key] = line;
        set(KEY, c).catch(() => {});
      } else {
        failedAt.set(key, Date.now());
      }
      return line;
    });
    inflight.set(key, p);
  }
  return p;
}
