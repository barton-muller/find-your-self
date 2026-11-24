import { BRAND } from './brand';
import type { Plan, SyncConfig } from './types';

const b64enc = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};
const b64dec = (s: string) => {
  const bin = atob(s.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

// A connection with a token goes to GitHub, or to a Forgejo, Gitea or Codeberg server when `server` is set. The two APIs are alike:
// the same contents calls with a sha, the same branch and repo objects. They differ in the address, the token header and
// that Forgejo creates a file with POST and updates it with PUT.
const apiBase = (c: SyncConfig) => (c.server ? `${c.server.replace(/\/+$/, '')}/api/v1/repos/${c.repo}` : `https://api.github.com/repos/${c.repo}`);
const host = (c: SyncConfig) => (c.server ? new URL(c.server).host : 'GitHub');
const url = (c: SyncConfig) => `${apiBase(c)}/contents/${c.path}`;
const headers = (c: SyncConfig): Record<string, string> =>
  c.server
    ? { Authorization: `token ${c.token}`, Accept: 'application/json' }
    : { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

export const configured = (c: SyncConfig | null): c is SyncConfig =>
  !!c && (!!c.token || !!c.viaGitHub) && /^[^/]+\/[^/]+$/.test(c.repo) && !!c.path && (!c.server || /^https:\/\/[^/]+/.test(c.server));

export async function fetchRemote(c: SyncConfig): Promise<{ plan: Plan; sha: string } | null> {
  const r = await fetch(`${url(c)}?ref=${encodeURIComponent(c.branch)}&_=${Date.now()}`, {
    headers: headers(c),
    cache: 'no-store',
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${host(c)} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return { plan: JSON.parse(b64dec(j.content)) as Plan, sha: j.sha };
}

async function putRemote(c: SyncConfig, plan: Plan, sha?: string, withBranch = true): Promise<boolean | null> {
  const r = await fetch(url(c), {
    method: c.server && !sha ? 'POST' : 'PUT',
    headers: { ...headers(c), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Update trip plan',
      content: b64enc(JSON.stringify(plan, null, 1)),
      ...(withBranch ? { branch: c.branch } : {}),
      ...(sha ? { sha } : {}),
    }),
  });
  if (r.status === 409 || r.status === 422) return false;
  if (r.status === 404 && !sha) return null;
  if (!r.ok) throw new Error(`${host(c)} ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return true;
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

async function diagnose(c: SyncConfig): Promise<string> {
  const r = await fetch(apiBase(c), { headers: headers(c), cache: 'no-store' });
  if (r.status === 404) return `Repo ${c.repo} not found for this token. Check the name, and that the token's repository access includes it.`;
  if (r.status === 401) return 'Token rejected (expired or wrong).';
  const j = await r.json();
  if (j.permissions && !j.permissions.push) return 'Token can read but not write: set Contents to Read and write.';
  return `Could not create ${c.path} on branch ${c.branch}. Add an initial commit (README) on that branch, or check the branch name.`;
}

export const samePlan = (a: Plan, b: Plan) => JSON.stringify(a) === JSON.stringify(b);

// Each person can have their own branch. Create it from the default branch when it does not exist yet.
// Returns true when the branch is the default one (only then may a first commit be made without naming a branch).
async function prepareBranch(c: SyncConfig): Promise<boolean> {
  const api = apiBase(c);
  const h = headers(c);
  const enc = encodeURIComponent;
  const exists = await fetch(`${api}/branches/${enc(c.branch)}`, { headers: h, cache: 'no-store' });
  if (exists.ok) return true;
  if (exists.status !== 404) return true;
  const repo = await fetch(api, { headers: h, cache: 'no-store' });
  if (!repo.ok) return true;
  const def = ((await repo.json()) as { default_branch: string }).default_branch;
  if (c.branch === def) return true;
  // A branch called "template" is the starting point for everyone else's branch (no personal data on it).
  // Without one, new branches start from the default branch.
  let baseName = def;
  let base = c.branch === 'template' ? null : await fetch(`${api}/git/ref/heads/template`, { headers: h, cache: 'no-store' });
  if (base?.ok) baseName = 'template';
  else base = await fetch(`${api}/git/ref/heads/${enc(def)}`, { headers: h, cache: 'no-store' });
  if (!base || !base.ok) throw new Error(`The repo has no ${baseName} branch yet. Add a first commit (a README) and try again.`);
  if (c.server) {
    // Forgejo has its own call for a new branch
    const mkb = await fetch(`${api}/branches`, {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_branch_name: c.branch, old_branch_name: baseName }),
    });
    if (!mkb.ok && mkb.status !== 409) throw new Error(`Could not create branch ${c.branch}: ${host(c)} ${mkb.status}`);
    return false;
  }
  const sha = ((await base.json()) as { object: { sha: string } }).object.sha;
  const mk = await fetch(`${api}/git/refs`, {
    method: 'POST',
    headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: `refs/heads/${c.branch}`, sha }),
  });
  if (!mk.ok && mk.status !== 422) throw new Error(`Could not create branch ${c.branch}: GitHub ${mk.status}`);
  return false;
}

export async function syncPlan(c: SyncConfig, local: Plan, attempt = 0): Promise<Plan> {
  const remote = await fetchRemote(c);
  if (!remote) {
    const onDefault = await prepareBranch(c);
    let r = await putRemote(c, local);
    if (r === null && onDefault) r = await putRemote(c, local, undefined, false);
    if (r === null) throw new Error(await diagnose(c));
    if (!r) throw new Error('Could not create file');
    return local;
  }
  const merged = mergePlans(local, remote.plan);
  if (samePlan(merged, remote.plan)) return merged;
  const ok = await putRemote(c, merged, remote.sha);
  if (!ok) {
    if (attempt >= 2) throw new Error('Sync conflict, try again');
    return syncPlan(c, merged, attempt + 1);
  }
  return merged;
}

export interface RemoteTrip { name: string; path: string }

// Where this app keeps its files in a repo: the root for repos that already have trips there (older setups), else a folder named after the app.
export async function detectDir(c: SyncConfig): Promise<string> {
  try {
    const r = await fetch(`${apiBase(c)}/contents/?ref=${encodeURIComponent(c.branch)}&_=${Date.now()}`, { headers: headers(c), cache: 'no-store' });
    if (!r.ok) return '';
    const root = (await r.json()) as { name: string; type: string }[];
    const legacy = root.some((e) => (e.type === 'dir' && e.name === 'trips') || (e.type === 'file' && e.name === 'plan.json'));
    return legacy ? '' : `${BRAND.folder}/`;
  } catch {
    return '';
  }
}

// Trips in the repo: every folder under trips/ that holds a plan.json, plus a plan.json in the app's root. Paths are relative to the app's folder.
export async function listRemoteTrips(c: SyncConfig): Promise<RemoteTrip[]> {
  const dir = c.dir ?? '';
  const api = (path: string) => `${apiBase(c)}/contents/${path}?ref=${encodeURIComponent(c.branch)}&_=${Date.now()}`;
  const get = async (path: string) => {
    const r = await fetch(api(path), { headers: headers(c), cache: 'no-store' });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`${host(c)} ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const j = await r.json();
    return Array.isArray(j) ? (j as { name: string; type: string }[]) : [];
  };
  const [root, trips] = await Promise.all([get(dir.replace(/\/$/, '')), get(`${dir}trips`)]);
  const out: RemoteTrip[] = [];
  if (root.some((e) => e.type === 'file' && e.name === 'plan.json')) out.push({ name: 'Main trip', path: 'plan.json' });
  for (const e of trips) if (e.type === 'dir') out.push({ name: e.name, path: `trips/${e.name}/plan.json` });
  return out;
}
