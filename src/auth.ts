import { get, set, del } from 'idb-keyval';
import { createClient, type AuthState, type RepoChoice } from 'pages-storage/client';
import { BRAND } from './brand';

// "Sign in with GitHub" with a GitHub App, done by the client in the pages-storage repo (client/ghstore.js):
// PKCE, the swap through the relay for tokens, and renewal. This file only wires it to this app's storage and address.
// After sign-in the app talks to api.github.com directly with the user's token.

export type { AuthState, RepoChoice };

// Kept in the default idb-keyval store, shared by every app on this origin, so one sign-in covers them all.
const KEY = 'gh-auth-v1';

export const authAvailable = !!(BRAND.auth.clientId && BRAND.auth.relay);

const client = createClient({
  clientId: BRAND.auth.clientId,
  relay: BRAND.auth.relay,
  appSlug: BRAND.auth.appSlug,
  name: 'gh-auth',
  storage: { get: async () => (await get<AuthState>(KEY)) ?? null, set: (a) => set(KEY, a), del: () => del(KEY) },
  cleanUrl: () => `${location.pathname}#/settings`,
});

// The older way back from GitHub's install page: a forwarder page at the origin root reads this note (see the relay repo).
const RETURN_KEY = 'gh-auth-return';
export const rememberReturn = () => {
  try { localStorage.setItem(RETURN_KEY, `${location.origin}${location.pathname}`); } catch { /* ignore */ }
};
export const installUrl = () => client.installUrl();
export const manageUrl = () => `https://github.com/apps/${BRAND.auth.appSlug}`;

export const startSignIn = () => client.signIn();
export const loadAuth = () => client.auth();
export const clearAuth = () => client.signOut();
// A valid access token, renewed through the relay shortly before it expires. Null when signed out.
export const freshAccess = () => client.token();
// Repos the app is installed on and the user can reach.
export const listRepos = () => client.repos();

// Called on every start. When the URL holds GitHub's ?code=&state= (or the return from installing the app), finishes it.
// Returns the new sign-in, null when there was nothing to finish, or throws with a readable message.
export async function finishSignIn(): Promise<AuthState | null> {
  const q = new URLSearchParams(location.search);
  const returning = q.has('code') || q.has('error') || q.has('installation_id');
  try {
    return await client.handleReturn();
  } finally {
    if (returning) window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}
