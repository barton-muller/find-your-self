import { BRAND } from './brand';

interface Brief { repo: string; token?: string; branch: string; trip?: string; path?: string; dir?: string; server?: string }

// A message to paste into an AI coding agent (Claude Code and similar) so it can edit trips in the repo.
export function aiBrief(o: Brief): string {
  const host = o.server ? new URL(o.server).host : 'github.com';
  const kind = o.server ? `git repo on ${host}` : 'GitHub repo';
  return `Help me edit my trip plans. They are stored in a ${kind} and shown in the trip planner app "${BRAND.name}" (${BRAND.repo}).

Repo: ${o.repo}
Branch: ${o.branch}
${o.token ? `Token: ${o.token}
Clone: git clone --branch ${o.branch} https://${o.token}@${host}/${o.repo}.git` : `Clone: git clone --branch ${o.branch} https://${host}/${o.repo}.git
Sign in to ${o.server ? host : 'GitHub'} on this computer first${o.server ? '' : ' (for example with: gh auth login)'}, so git can push to this private repo.`}
${o.dir ? `This app's files are in the folder ${o.dir} of the repo (other apps may use other folders). Work inside it, and read ${o.dir}AGENTS.md first.\n` : ''}${o.path ? `Current trip: "${o.trip ?? ''}" in ${o.path}. Other trips are in ${o.dir ?? ''}trips/<name>/plan.json.` : `Trips are in ${o.dir ?? ''}trips/<name>/plan.json.`}

${o.token ? 'The token is an access token with write access to this one repo. Use it only for this repo. Do not print it back, and do not write it into any file or commit.' : 'Use my own login for this repo. Do not write credentials into any file or commit.'}

How to work:
1. Clone the repo and stay on branch ${o.branch}. ${o.branch === 'main' || o.branch === 'master' ? 'Pull before you start and commit to it normally.' : 'It is my own branch. Do not switch to, edit or push to main or to other branches (u/...).'}
2. Read AGENTS.md and the DECISIONS.md files first. They hold the rules and my preferences. If AGENTS.md is missing, use the notes below.
3. Run git pull before you start. The app also commits to this branch.
4. If the repo has scripts/plan.py, edit trips through it. It validates the plan and keeps updatedAt right. Run python3 scripts/plan.py summary trips/<name>/plan.json before you push.
5. Commit with a short message and push to ${o.branch}. The app picks the change up the next time it syncs.
6. Tell me what you changed.

Plan format (if AGENTS.md is missing):
- plan: v:1, start, end (YYYY-MM-DD), startId, stops{}, legs{}, todos{}, metaUpdatedAt.
- stop: id (same as its key), name, lat, lng, nights, notes, days[] (free text per day), activeOut (the chosen outgoing leg at a fork), updatedAt, deleted.
- leg: id, from, to, options[] (id, mode, duration, cost, notes, overnight, extraDays, booked), chosen (option id), updatedAt, deleted.
- Dates come from walking the active path from startId: next arrival = arrival + nights + the chosen option's extraDays. A stop with several outgoing legs is a fork.
- Never remove records. Set deleted: true. Set updatedAt to the current time in milliseconds on every record you change. The app merges per record and the newest updatedAt wins.

More: README ${BRAND.repo}#readme
Sync and AI guide: ${BRAND.syncGuide}
Sharing with friends: ${BRAND.repo}/blob/main/docs/FRIENDS.md
`;
}
