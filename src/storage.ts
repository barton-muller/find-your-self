import { createStore, del as idel, get as iget, set as iset, type UseStore } from 'idb-keyval';
import { BRAND } from './brand';

// All of this app's data lives under its own prefix, so other apps on the same origin cannot touch it
// (browser storage is shared by every page of one origin, for example barton-muller.github.io/...).
// The GitHub sign-in token is the exception: auth.ts keeps it in the default store so sites can share one sign-in.

const P = BRAND.storage;
const db: UseStore = createStore(`${P}-db`, 'keyval');

export const get = <T = unknown>(key: IDBValidKey) => iget<T>(key, db);
export const set = (key: IDBValidKey, value: unknown) => iset(key, value, db);
export const del = (key: IDBValidKey) => idel(key, db);

export const lsGet = (k: string): string | null => {
  try { return localStorage.getItem(`${P}:${k}`) ?? localStorage.getItem(k); } catch { return null; }
};
export const lsSet = (k: string, v: string) => {
  try { localStorage.setItem(`${P}:${k}`, v); } catch { /* ignore */ }
};
export const ssGet = (k: string): string | null => {
  try { return sessionStorage.getItem(`${P}:${k}`); } catch { return null; }
};
export const ssSet = (k: string, v: string) => {
  try { sessionStorage.setItem(`${P}:${k}`, v); } catch { /* ignore */ }
};

const MIGRATED = 'migrated-v1';

// Earlier versions kept everything in the default store. Copy it into this app's own store once (the originals stay as a backup).
export async function migrateLegacy(): Promise<void> {
  try {
    if (await get(MIGRATED)) return;
    if (!(await get('trips-v1')) && !(await get('plan-v1'))) {
      const trips = await iget<{ list: { id: string }[] }>('trips-v1');
      const legacyPlan = await iget('plan-v1');
      if (!trips && !legacyPlan) {
        await set(MIGRATED, true);
        return;
      }
      const keys = ['trips-v1', 'plan-v1', 'sync-cfg-v1', 'wx-v3', 'route-cache-v1', 'tiles-overview-v2'];
      for (const t of trips?.list ?? []) keys.push(`plan:${t.id}`);
      for (const k of keys) {
        const v = await iget(k);
        if (v !== undefined) await set(k, v);
      }
    }
    await set(MIGRATED, true);
  } catch {
    /* storage unavailable: the app starts empty */
  }
}
