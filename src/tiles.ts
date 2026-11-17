import { get, set } from './storage';
import type { Plan } from './types';

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_CACHE = 'osm-tiles';
const FLAG = 'tiles-overview-v2';

export interface Pt { lat: number; lng: number }

const FALLBACK = { s: -11, n: 33, w: 92, e: 128 };
const MAX_TILES = 700;
const MARGIN = 2;

export const planPts = (p: Plan): Pt[] =>
  Object.values(p.stops)
    .filter((s) => !s.deleted && s.lat !== null && s.lng !== null)
    .map((s) => ({ lat: s.lat as number, lng: s.lng as number }));

const tx = (lng: number, z: number) => Math.min(2 ** z - 1, Math.max(0, Math.floor(((lng + 180) / 360) * 2 ** z)));
const ty = (lat: number, z: number) => {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return Math.min(2 ** z - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)));
};

const bounds = (pts: Pt[]) => {
  if (!pts.length) return FALLBACK;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  return {
    s: Math.max(-85, Math.min(...lats) - MARGIN),
    n: Math.min(85, Math.max(...lats) + MARGIN),
    w: Math.max(-180, Math.min(...lngs) - MARGIN),
    e: Math.min(180, Math.max(...lngs) + MARGIN),
  };
};

const url = (z: number, x: number, y: number) => TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

// Whole world at low zoom, then the region around the stops at higher zoom (as many levels as fit).
export const overviewUrls = (pts: Pt[]): string[] => {
  const urls: string[] = [];
  for (let z = 0; z <= 3; z++) for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) urls.push(url(z, x, y));
  const b = bounds(pts);
  for (const z of [4, 5, 6, 7]) {
    const layer: string[] = [];
    for (let x = tx(b.w, z); x <= tx(b.e, z); x++) for (let y = ty(b.n, z); y <= ty(b.s, z); y++) layer.push(url(z, x, y));
    if (urls.length + layer.length > MAX_TILES) break;
    urls.push(...layer);
  }
  return urls;
};

const signature = (pts: Pt[]) => {
  const b = bounds(pts);
  return `v2:${[b.s, b.n, b.w, b.e].map(Math.round).join(',')}`;
};

export async function prefetchOverview(pts: Pt[], force = false): Promise<{ ok: number; total: number } | null> {
  if (typeof caches === 'undefined' || !navigator.onLine) return null;
  const sig = signature(pts);
  if (!force && (await get(FLAG).catch(() => null)) === sig) return null;
  const cache = await caches.open(TILE_CACHE);
  const urls = overviewUrls(pts);
  let ok = 0;
  let i = 0;
  const worker = async () => {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        if (!force && (await cache.match(u))) {
          ok++;
          continue;
        }
        const r = await fetch(u, { mode: 'cors', credentials: 'omit' });
        if (r.ok) {
          await cache.put(u, r);
          ok++;
        }
      } catch {
        /* offline or blocked */
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (ok >= urls.length * 0.9) await set(FLAG, sig).catch(() => {});
  return { ok, total: urls.length };
}

export const overviewCount = async (pts: Pt[]): Promise<{ saved: number; total: number }> => {
  const urls = overviewUrls(pts);
  if (typeof caches === 'undefined') return { saved: 0, total: urls.length };
  const cache = await caches.open(TILE_CACHE);
  let saved = 0;
  for (const u of urls) if (await cache.match(u)) saved++;
  return { saved, total: urls.length };
};
