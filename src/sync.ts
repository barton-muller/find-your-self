import { Conflict, storeFromUrl, type Store } from 'pages-storage/store';
import { BRAND } from './brand';
import type { Plan, SyncConfig } from './types';

// All talking to a git host goes through one store from pages-storage (GitHub, GitLab, Forgejo, Gitea, Codeberg). The store tells the
// host from the repo address, reports errors in plain words (wrong token, repo not found, a host answering in a way it does not
// understand), and commits through each host's own API. This file only knows trips: which file, how to merge two plans.

export const configured = (c: SyncConfig | null): c is SyncConfig =>
  !!c && (!!c.token || !!c.viaGitHub) && /^[^/]+(\/[^/]+)+$/.test(c.repo) && !!c.path && (!c.server || /^https:\/\/[^/]+/.test(c.server));

// The address of the repo as people copy it for git clone. GitHub when there is no server.
export const repoUrl = (c: SyncConfig) => `${c.server ?? 'https://github.com'}/${c.repo}`;

// One store per connection. A self-hosted server is probed once, not on every sync.
const stores = new Map<string, Promise<Store>>();
function storeFor(c: SyncConfig): Promise<Store> {
  const key = `${repoUrl(c)}\n${c.branch}\n${c.token}`;
  let s = stores.get(key);
  if (!s) {
    s = storeFromUrl(repoUrl(c), { token: c.token, branch: c.branch || undefined });
    stores.set(key, s);
    s.catch(() => stores.delete(key)); // a failure (wrong token, no network) is tried again next time
  }
  return s;
}

const readPlan = async (store: Store, id: string) => JSON.parse(await store.read(id)) as Plan;

export async function fetchRemote(c: SyncConfig): Promise<{ plan: Plan; sha: string } | null> {
  const store = await storeFor(c);
  const id = (await store.fetch()).files[c.path];
  return id ? { plan: await readPlan(store, id), sha: id } : null;
}

const newer = <T extends { updatedAt: number }>(a?: T, b?: T): T | undefined => {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
};

export function mergePlans(local: Plan, remote: Plan): Plan {
  const metaWinner = remote.metaUpdatedAt > local.metaUpdatedAt ? remote : local;
  const stops: Plan['stops'] = {};
  for (const id of new Set([...Object.keys(local.stops), ...Object.keys(remote.stops)])) {
    stops[id] = newer(local.stops[id], remote.stops[id])!;
  }
  const legs: Plan['legs'] = {};
  for (const id of new Set([...Object.keys(local.legs), ...Object.keys(remote.legs)])) {
    legs[id] = newer(local.legs[id], remote.legs[id])!;
  }
  const todos: NonNullable<Plan['todos']> = {};
  const lt = local.todos ?? {};
  const rt = remote.todos ?? {};
  for (const id of new Set([...Object.keys(lt), ...Object.keys(rt)])) {
    todos[id] = newer(lt[id], rt[id])!;
  }
  return {
    v: 1,
    todos,
    start: metaWinner.start,
    end: metaWinner.end,
    startId: metaWinner.startId,
    metaUpdatedAt: metaWinner.metaUpdatedAt,
    stops,
    legs,
  };
}

export const samePlan = (a: Plan, b: Plan) => JSON.stringify(a) === JSON.stringify(b);

const MESSAGE = 'Update trip plan';
const json = (p: Plan) => JSON.stringify(p, null, 1);

export async function syncPlan(c: SyncConfig, local: Plan): Promise<Plan> {
  const store = await storeFor(c);
  for (let attempt = 0; ; attempt++) {
    let snap = await store.fetch();
    const id = snap.files[c.path];
    if (!id) {
      // The first sync of this trip. A personal branch is made first, from the repo's "template" branch if it has one.
      if (snap.revision === null) {
        await store.ensureBranch({ from: 'template' });
        snap = await store.fetch();
      }
      try {
        await store.commit(snap.revision, { [c.path]: json(local) }, MESSAGE);
        return local;
      } catch (e) {
        if (e instanceof Conflict && attempt < 2) continue;
        throw e;
      }
    }
    const remote = await readPlan(store, id);
    const merged = mergePlans(local, remote);
    if (samePlan(merged, remote)) return merged;
    try {
      await store.commit(snap.revision, { [c.path]: json(merged) }, MESSAGE);
      return merged;
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
      if (attempt >= 2) throw new Error('Sync conflict, try again');
      local = merged; // someone else committed in between: merge again on what is there now
    }
  }
}

export interface RemoteTrip { name: string; path: string }

// Where this app keeps its files in a repo: the root for repos that already have trips there (older setups), else a folder named after the app.
export async function detectDir(c: SyncConfig): Promise<string> {
  const files = Object.keys((await (await storeFor(c)).fetch()).files);
  const legacy = files.some((p) => p === 'plan.json' || p.startsWith('trips/'));
  return legacy ? '' : `${BRAND.folder}/`;
}

// Trips in the repo: every folder under trips/ that holds a plan.json, plus a plan.json in the app's root. Paths are relative to the app's folder.
export async function listRemoteTrips(c: SyncConfig): Promise<RemoteTrip[]> {
  const dir = c.dir ?? '';
  const out: RemoteTrip[] = [];
  for (const p of Object.keys((await (await storeFor(c)).fetch()).files)) {
    if (!p.startsWith(dir)) continue;
    const rel = p.slice(dir.length);
    if (rel === 'plan.json') out.unshift({ name: 'Main trip', path: rel });
    else {
      const m = rel.match(/^trips\/([^/]+)\/plan\.json$/);
      if (m) out.push({ name: m[1]!, path: rel });
    }
  }
  return out;
}
