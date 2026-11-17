import { BRAND } from './brand';
import { createRepo, freshAccess, listRepos } from './auth';

// The starter files for a new data repo are the ones in data-template/, bundled at build time: the rules and scripts an AI agent needs.
const raw = import.meta.glob(['../data-template/*.md', '../data-template/scripts/*.py'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const FOLDER_NOTE = `> This folder holds the trips of ${BRAND.name} inside a repo that may hold other apps' data too. Work inside it (\`cd ${BRAND.folder}\`). Paths below are relative to this folder.\n\n`;

export function templateFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const name = k.replace('../data-template/', '');
    if (name === 'CLAUDE.md') continue;
    out[`${BRAND.folder}/${name}`] = name === 'AGENTS.md'
      ? FOLDER_NOTE + v.replace('`CLAUDE.md` is a symlink to this file.', '`CLAUDE.md` imports this file.')
      : v;
  }
  out[`${BRAND.folder}/CLAUDE.md`] = '@AGENTS.md\n';
  out['CLAUDE.md'] = `@${BRAND.folder}/AGENTS.md\n`;
  return out;
}

const rootReadme = (name: string) => `# ${name}

Data kept by web apps that use GitHub as their storage. Each app keeps its files in its own folder.

- \`${BRAND.folder}/\`: trips for ${BRAND.name} (${BRAND.repo}). AI agents: read \`${BRAND.folder}/AGENTS.md\` first.
`;

export interface NewRepo { full: string; branch: string; ready: boolean }

// Creates a private repo. ready is false when GitHub made the repo but the app cannot reach it yet.
// The starter files are not written here: call pushStarterFiles afterwards, in the background.
export async function createDataRepo(): Promise<NewRepo> {
  let made: { full: string; branch: string } | null = null;
  for (let n = 1; n <= 5 && !made; n++) {
    const name = n === 1 ? `${BRAND.folder}-data` : `${BRAND.folder}-data-${n}`;
    try {
      made = await createRepo(name, `Data for ${BRAND.name}`);
    } catch (e) {
      if (!/already exists/.test(String((e as Error).message))) throw e;
    }
  }
  if (!made) throw new Error('Could not find a free repo name. Create one on github.com and add it with "Add existing".');
  const ready = (await listRepos()).some((r) => r.full === made!.full);
  return { ...made, ready };
}

// Adds the starter files in one commit through the Git data API (a handful of requests, however many files).
// A branch that moved in the meantime, for example from the first sync, makes the last step fail, so it starts again.
export async function pushStarterFiles(repo: string, branch: string): Promise<void> {
  const token = await freshAccess();
  if (!token) throw new Error('Signed out of GitHub.');
  const api = `https://api.github.com/repos/${repo}`;
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
  const call = async (path: string, method = 'GET', body?: unknown) => {
    const r = await fetch(`${api}${path}`, { method, headers: h, cache: 'no-store', ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!r.ok && !(method === 'PATCH' && (r.status === 422 || r.status === 409))) throw new Error(`GitHub ${r.status}`);
    return r;
  };
  const files = { 'README.md': rootReadme(repo.split('/')[1]), ...templateFiles() };
  for (let attempt = 0; attempt < 4; attempt++) {
    const head = ((await (await call(`/git/ref/heads/${encodeURIComponent(branch)}`)).json()) as { object: { sha: string } }).object.sha;
    const base = ((await (await call(`/git/commits/${head}`)).json()) as { tree: { sha: string } }).tree.sha;
    const tree = (await (await call('/git/trees', 'POST', {
      base_tree: base,
      tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })),
    })).json()) as { sha: string };
    const commit = (await (await call('/git/commits', 'POST', { message: `Add starter files for ${BRAND.name}`, tree: tree.sha, parents: [head] })).json()) as { sha: string };
    const up = await call(`/git/refs/heads/${encodeURIComponent(branch)}`, 'PATCH', { sha: commit.sha });
    if (up.ok) return;
  }
  throw new Error('The branch kept changing. Try again later.');
}
