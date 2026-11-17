import { prettyName, slug } from './trips';

export interface Invite { repo: string; token: string; branch: string; name?: string }

const b64url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

const okRepo = (r: string) => /^[\w.-]+\/[\w.-]+$/.test(r);
const okToken = (t: string) => /^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t);
const okBranch = (b: string) => /^[\w./-]{1,100}$/.test(b) && !b.includes('..') && !b.startsWith('/') && !b.endsWith('/');

// Short form: owner~repo~person~token (the github_pat_ prefix is left out). The person's branch is u/<person>.
export const makeInviteLink = (inv: Invite): string => {
  const base = `${location.origin}${location.pathname}`;
  const person = inv.branch.startsWith('u/') ? inv.branch.slice(2) : '';
  if (person && /^[a-z0-9-]+$/.test(person)) {
    const t = inv.token.startsWith('github_pat_') ? inv.token.slice('github_pat_'.length) : inv.token;
    return `${base}#/j/${inv.repo.replace('/', '~')}~${person}~${t}`;
  }
  return `${base}#/join/${b64url(JSON.stringify({ v: 1, r: inv.repo, t: inv.token, b: inv.branch, n: inv.name }))}`;
};

// The part of a link or pasted text that identifies the invite (what goes after #/join/).
export function inviteCode(input: string): string | null {
  const s = input.trim();
  const m = s.match(/#\/(?:j|join)\/([A-Za-z0-9_~-]+)/) ?? s.match(/^([A-Za-z0-9_~-]{30,})$/);
  return m ? m[1] : null;
}

export function parseInvite(input: string): Invite | null {
  const code = inviteCode(input);
  if (!code) return null;
  try {
    if (code.includes('~')) {
      const [owner, repo, person, rest] = code.split('~');
      if (!owner || !repo || !person || !rest || code.split('~').length !== 4) return null;
      const token = rest.startsWith('ghp_') ? rest : `github_pat_${rest}`;
      const inv: Invite = { repo: `${owner}/${repo}`, token, branch: `u/${person}`, name: prettyName(person) };
      return okRepo(inv.repo) && okToken(inv.token) && okBranch(inv.branch) && slug(person) === person ? inv : null;
    }
    const j = JSON.parse(unb64url(code)) as { v?: number; r?: string; t?: string; b?: string; n?: string };
    if (j.v !== 1 || !j.r || !j.t || !j.b) return null;
    if (!okRepo(j.r) || !okToken(j.t) || !okBranch(j.b)) return null;
    return { repo: j.r, token: j.t, branch: j.b, name: typeof j.n === 'string' ? j.n.slice(0, 60) : undefined };
  } catch {
    return null;
  }
}
