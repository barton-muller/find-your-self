import { BRAND } from './brand';
import { createRepo, listRepos, putFile } from './auth';

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

// Creates a private repo with the starter files. ready is false when GitHub made the repo but the app cannot reach it yet.
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
  const reachable = (await listRepos()).some((r) => r.full === made!.full);
  if (!reachable) return { ...made, ready: false };
  await putFile(made.full, 'README.md', rootReadme(made.full.split('/')[1]));
  for (const [path, text] of Object.entries(templateFiles())) await putFile(made.full, path, text);
  return { ...made, ready: true };
}
