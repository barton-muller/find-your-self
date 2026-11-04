import { get, set } from 'idb-keyval';

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_CACHE = 'osm-tiles';
const FLAG = 'tiles-overview-v1';

const BOUNDS = { s: -11, n: 33, w: 92, e: 128 };
const ZOOMS = [3, 4, 5, 6];

const tx = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const ty = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export const overviewUrls = (): string[] => {
  const urls: string[] = [];
  for (const z of ZOOMS) {
    for (let x = tx(BOUNDS.w, z); x <= tx(BOUNDS.e, z); x++) {
      for (let y = ty(BOUNDS.n, z); y <= ty(BOUNDS.s, z); y++) {
        urls.push(TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
      }
    }
  }
  return urls;
};

export async function prefetchOverview(force = false): Promise<{ ok: number; total: number } | null> {
  if (typeof caches === 'undefined' || !navigator.onLine) return null;
  if (!force && (await get(FLAG).catch(() => false))) return null;
  const cache = await caches.open(TILE_CACHE);
  const urls = overviewUrls();
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
  if (ok >= urls.length * 0.9) await set(FLAG, true).catch(() => {});
  return { ok, total: urls.length };
}

export const overviewCount = async (): Promise<number> => {
  if (typeof caches === 'undefined') return 0;
  const cache = await caches.open(TILE_CACHE);
  const urls = overviewUrls();
  let n = 0;
  for (const u of urls) if (await cache.match(u)) n++;
  return n;
};
