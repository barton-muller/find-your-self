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

export const makeInviteLink = (inv: Invite): string =>
  `${location.origin}${location.pathname}#/join/${b64url(JSON.stringify({ v: 1, r: inv.repo, t: inv.token, b: inv.branch, n: inv.name }))}`;

// Accepts a full link or just the code after #/join/. Returns null when it is not a valid invite.
export function parseInvite(input: string): Invite | null {
  const m = input.trim().match(/#\/join\/([A-Za-z0-9_-]+)/) ?? input.trim().match(/^([A-Za-z0-9_-]{30,})$/);
  if (!m) return null;
  try {
    const j = JSON.parse(unb64url(m[1])) as { v?: number; r?: string; t?: string; b?: string; n?: string };
    if (j.v !== 1 || !j.r || !j.t || !j.b) return null;
    if (!/^[\w.-]+\/[\w.-]+$/.test(j.r)) return null;
    if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(j.t)) return null;
    if (!/^[\w./-]{1,100}$/.test(j.b) || j.b.includes('..') || j.b.startsWith('/') || j.b.endsWith('/')) return null;
    return { repo: j.r, token: j.t, branch: j.b, name: typeof j.n === 'string' ? j.n.slice(0, 60) : undefined };
  } catch {
    return null;
  }
}
