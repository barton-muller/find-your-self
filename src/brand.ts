export const BRAND = {
  name: 'Go Find Yourself',
  short: 'Find Yourself',
  tagline: 'A trip planner for routes that branch.',
  // Names this app's data in the browser. Sites on one origin (for example several github.io project pages) share browser storage,
  // so every app that runs there needs its own value. The GitHub sign-in token is shared on purpose.
  storage: 'gfy',
  repo: 'https://github.com/barton-muller/find-your-self',
  fork: 'https://github.com/barton-muller/find-your-self/fork',
  guide: 'https://github.com/barton-muller/find-your-self/blob/main/docs/MAKE-YOUR-OWN.md',
  syncGuide: 'https://github.com/barton-muller/find-your-self/blob/main/docs/SYNC-AND-AI.md',
  tokenGuide: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token',
  // "Sign in with GitHub" is off until these three public values are filled in (see docs/GITHUB-SIGN-IN.md). Set them here, or as VITE_GH_CLIENT_ID, VITE_GH_RELAY and VITE_GH_APP_SLUG at build time.
  auth: {
    clientId: (import.meta.env?.VITE_GH_CLIENT_ID as string | undefined) ?? '', // GitHub App client ID
    relay: (import.meta.env?.VITE_GH_RELAY as string | undefined) ?? '', // https://gfy-github-auth.<you>.workers.dev
    appSlug: (import.meta.env?.VITE_GH_APP_SLUG as string | undefined) ?? '', // GitHub App name in its URL: github.com/apps/<slug>
  },
} as const;
