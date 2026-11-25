# Make your own copy

Go Find Yourself is a static website. You can copy it to your own GitHub account, change anything you like, and publish it at your own address. It takes about five minutes and costs nothing.

The app was written with AI help. The sync with git hosts has automated tests (`npm run test:sync`); the rest is checked by hand. Treat it as a starting point, not a finished product. That is also why copying it is encouraged: you can fix what bothers you and add what you need.

## Steps

1. **Fork the repo.** Open the [fork page](https://github.com/barton-muller/find-your-self/fork) and click *Create fork*. You need a free GitHub account.
2. **Turn on GitHub Pages.** In your fork go to *Settings, Pages*. Under *Build and deployment*, set *Source* to *GitHub Actions*.
3. **Run the deploy.** Open the *Actions* tab. GitHub switches workflows off in new forks, so click the green button to enable them. Pick *Deploy* in the list, then *Run workflow*. It takes about a minute.
4. **Open your site.** The address is `https://YOUR-USERNAME.github.io/REPO-NAME/`. You can also find it on the finished *Deploy* run.

From then on, every push to `main` builds and publishes the site again.

Your copy keeps its own data. A site at a different address has its own browser storage, so your trip in one copy does not show in another.

## Change it

Two ways.

**With an AI coding agent.** Open your fork in a tool such as Claude Code. Tell it what you want, for example "add a packing list tab" or "make the accent colour purple". It will read `AGENTS.md`, which describes the code. Look at what it did before you push.

**By hand.**
```
git clone https://github.com/YOUR-USERNAME/REPO-NAME
cd REPO-NAME
npm install
npm run dev
```
`npm run build` checks the types and builds the site.

Before you publish, look at `auth` in `src/brand.ts`. It holds the original author's public GitHub App values for "Sign in with GitHub". Their relay refuses requests from your site, so the button would fail for your users. Either set your own three values (see [Set up Sign in with GitHub](GITHUB-SIGN-IN.md)) or empty them to hide the button.

The build adds a Content Security Policy that lets the app talk only to the services it uses: GitHub, GitLab.com, Codeberg, your sign-in relay, and the map, route and weather services. If people should be able to connect to a git server of your own, allow it when you build: set `VITE_CSP_CONNECT="https://git.example.org"` (a space-separated list) as a repository variable and pass it to the build step in `.github/workflows/deploy.yml`.

Things you will probably want to change first:
- Name, tagline and links: `src/brand.ts`. Also `index.html`, and the title in `vite.config.ts`, if you rename it.
- Storage name: `storage` in `src/brand.ts`. Browser storage is shared by every page on one address, so two apps on `you.github.io` would overwrite each other's data unless each has its own name.
- Icon: `public/icon.svg`. Run `node scripts/icons.cjs` to make the PNG versions (needs Playwright).
- Colours: the CSS variables at the top of `src/styles.css`.
- The example trip new users see: `src/seed.ts`.

## Rename the repo

*Settings, General, Repository name*. The site address changes with it. Links in `README.md` and `src/brand.ts` that point to the old name need updating.

## Before many people use your copy

The app calls free public services. They are fine for personal use and small groups, and not for heavy traffic.

| Service | Used for | Limit to know about |
|---|---|---|
| tile.openstreetmap.org | Map tiles | [Tile usage policy](https://operations.osmfoundation.org/policies/tiles/): light use only. Switch to a tile provider that allows your traffic. |
| router.project-osrm.org | Road routes on the map | Public demo server, no guarantees. |
| api.open-meteo.com | Weather | Free for non-commercial use. [Terms](https://open-meteo.com/en/terms) ask for credit, which the app gives. |

## Stay up to date with the original

On your fork's page, use *Sync fork*. If you changed the same files as the original, GitHub will ask you to resolve conflicts. An AI agent is good at that job.

## Share it back

If you fix a bug or build something others would want, open a pull request or an issue on the [original repo](https://github.com/barton-muller/find-your-self).
