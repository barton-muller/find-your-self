import { get, set, del } from 'idb-keyval';
import { BRAND } from './brand';

// "Sign in with GitHub" with a GitHub App. The browser sends the user to github.com, GitHub sends back a one-time code,
// and a small relay (the github-auth-relay repo) swaps it for tokens, because that step needs the app's client secret.
// PKCE ties the code to this browser. After that the app talks to api.github.com directly with the user's token.

export interface AuthState {
  login: string;
  access: string;
  expiresAt: number;
  refresh: string | null;
  refreshExpiresAt: number | null;
}

const KEY = 'gh-auth-v1';
const PENDING = 'gh-auth-pending';
const SKEW = 5 * 60 * 1000;

export const authAvailable = !!(BRAND.auth.clientId && BRAND.auth.relay);
// Before the person leaves for github.com to install the app, leave a note saying which site to come back to.
// All pages of one origin share localStorage, so a forwarder page at the root of the origin can read it (see the relay repo).
const RETURN_KEY = 'gh-auth-return';
export const rememberReturn = () => {
  try { localStorage.setItem(RETURN_KEY, redirectUri()); } catch { /* ignore */ }
};
export const installUrl = () => `https://github.com/apps/${BRAND.auth.appSlug}/installations/new?state=${encodeURIComponent(redirectUri())}`;
export const manageUrl = () => `https://github.com/apps/${BRAND.auth.appSlug}`;

const rand = (n: number) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const sha256url = async (s: string) => {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return btoa(String.fromCharCode(...h)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const redirectUri = () => `${location.origin}${location.pathname}`;

export async function startSignIn(): Promise<void> {
  const verifier = rand(48);
  const state = rand(16);
  sessionStorage.setItem(PENDING, JSON.stringify({ verifier, state, redirect: redirectUri() }));
  const q = new URLSearchParams({
    client_id: BRAND.auth.clientId,
    redirect_uri: redirectUri(),
    state,
    code_challenge: await sha256url(verifier),
    code_challenge_method: 'S256',
  });
  location.assign(`https://github.com/login/oauth/authorize?${q}`);
}

const relay = async (path: string, body: object) => {
  const r = await fetch(`${BRAND.auth.relay.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error ? `Sign-in failed: ${j.error}` : `Sign-in failed (${r.status})`);
  return j as { access_token: string; expires_in: number | null; refresh_token: string | null; refresh_token_expires_in: number | null };
};

const toState = (j: Awaited<ReturnType<typeof relay>>, login: string): AuthState => ({
  login,
  access: j.access_token,
  expiresAt: j.expires_in ? Date.now() + j.expires_in * 1000 : Date.now() + 365 * 86400e3,
  refresh: j.refresh_token,
  refreshExpiresAt: j.refresh_token_expires_in ? Date.now() + j.refresh_token_expires_in * 1000 : null,
});

export const loadAuth = (): Promise<AuthState | null> => get<AuthState>(KEY).then((a) => a ?? null).catch(() => null);
export const clearAuth = () => del(KEY).catch(() => {});

// Called on every start. When the URL holds GitHub's ?code=...&state=..., finishes the sign-in.
// Returns the new state, null when the page is not a sign-in return, or throws with a readable message.
export async function finishSignIn(): Promise<AuthState | null> {
  const q = new URLSearchParams(location.search);
  const code = q.get('code');
  const state = q.get('state');
  const err = q.get('error');
  // GitHub returns here after the app is installed or changed on a repo (?installation_id=...&setup_action=...).
  // That is not a sign-in: drop the query and let the repo list reload.
  if (q.has('installation_id')) {
    history.replaceState(null, '', `${location.pathname}#/settings`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return null;
  }
  if (!code && !err) return null;
  const clean = () => {
    history.replaceState(null, '', `${location.pathname}#/settings`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const raw = sessionStorage.getItem(PENDING);
  sessionStorage.removeItem(PENDING);
  if (err) {
    clean();
    throw new Error(`GitHub: ${q.get('error_description') || err}`);
  }
  const pending = raw ? (JSON.parse(raw) as { verifier: string; state: string; redirect: string }) : null;
  if (!pending || pending.state !== state) {
    clean();
    throw new Error('Sign-in was not started in this browser. Try again.');
  }
  clean();
  const j = await relay('/token', { code, redirect_uri: pending.redirect, code_verifier: pending.verifier });
  const u = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${j.access_token}`, Accept: 'application/vnd.github+json' } });
  const login = u.ok ? ((await u.json()) as { login: string }).login : 'GitHub user';
  const a = toState(j, login);
  await set(KEY, a);
  return a;
}

let refreshing: Promise<AuthState | null> | null = null;

// A valid access token, refreshed through the relay when it is about to expire. Null when signed out.
export async function freshAccess(): Promise<string | null> {
  const a = await loadAuth();
  if (!a) return null;
  if (a.expiresAt - SKEW > Date.now()) return a.access;
  if (!a.refresh || (a.refreshExpiresAt && a.refreshExpiresAt < Date.now())) {
    await clearAuth();
    return null;
  }
  refreshing ??= relay('/refresh', { refresh_token: a.refresh })
    .then(async (j) => {
      const n = toState(j, a.login);
      await set(KEY, n);
      return n;
    })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  const n = await refreshing;
  return n ? n.access : null;
}

export interface RepoChoice { full: string; branch: string }

// Repos the app is installed on and the user can reach.
export async function listRepos(token: string): Promise<RepoChoice[]> {
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  const inst = await fetch('https://api.github.com/user/installations?per_page=100', { headers: h });
  if (!inst.ok) throw new Error(`GitHub ${inst.status}`);
  const ids = ((await inst.json()) as { installations: { id: number }[] }).installations.map((i) => i.id);
  const out: RepoChoice[] = [];
  for (const id of ids) {
    const r = await fetch(`https://api.github.com/user/installations/${id}/repositories?per_page=100`, { headers: h });
    if (!r.ok) continue;
    for (const x of ((await r.json()) as { repositories: { full_name: string; default_branch: string }[] }).repositories) {
      out.push({ full: x.full_name, branch: x.default_branch });
    }
  }
  return out;
}
