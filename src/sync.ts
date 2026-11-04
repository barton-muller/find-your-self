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

const url = (c: SyncConfig) => `https://api.github.com/repos/${c.repo}/contents/${c.path}`;
const headers = (c: SyncConfig) => ({
  Authorization: `Bearer ${c.token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export const configured = (c: SyncConfig | null): c is SyncConfig => !!c && !!c.token && /^[^/]+\/[^/]+$/.test(c.repo) && !!c.path;

async function fetchRemote(c: SyncConfig): Promise<{ plan: Plan; sha: string } | null> {
  const r = await fetch(`${url(c)}?ref=${encodeURIComponent(c.branch)}&_=${Date.now()}`, {
    headers: headers(c),
    cache: 'no-store',
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  return { plan: JSON.parse(b64dec(j.content)) as Plan, sha: j.sha };
}

async function putRemote(c: SyncConfig, plan: Plan, sha?: string, withBranch = true): Promise<boolean | null> {
  const r = await fetch(url(c), {
    method: 'PUT',
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
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 160)}`);
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
  const r = await fetch(`https://api.github.com/repos/${c.repo}`, { headers: headers(c), cache: 'no-store' });
  if (r.status === 404) return `Repo ${c.repo} not found for this token. Check the name, and that the token's repository access includes it.`;
  if (r.status === 401) return 'Token rejected (expired or wrong).';
  const j = await r.json();
  if (j.permissions && !j.permissions.push) return 'Token can read but not write: set Contents to Read and write.';
  return `Could not create ${c.path} on branch ${c.branch}. Add an initial commit (README) on that branch, or check the branch name.`;
}

export const samePlan = (a: Plan, b: Plan) => JSON.stringify(a) === JSON.stringify(b);

export async function syncPlan(c: SyncConfig, local: Plan, attempt = 0): Promise<Plan> {
  const remote = await fetchRemote(c);
  if (!remote) {
    let r = await putRemote(c, local);
    if (r === null) r = await putRemote(c, local, undefined, false);
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
