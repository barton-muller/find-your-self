# Set up "Sign in with GitHub"

This is for whoever runs the app (you, or a fork owner). People who only use the app need none of it.

Without it, people connect GitHub by making a token by hand. With it, they press **Sign in with GitHub**, approve, and pick a repo from a list. The button stays hidden until you finish the steps below.

## How it works

1. The app sends the person to github.com to approve.
2. GitHub sends them back with a one-time code.
3. The app sends that code to a small function you run (the relay). The relay adds your app's client secret and asks GitHub for the person's access token. This step needs a secret, and GitHub does not allow it from a web page, so it cannot happen in the app.
4. The app keeps the token on the device and talks to GitHub directly from then on. The relay is used again only to renew the token, which lasts 8 hours.

The relay keeps nothing: no database and no copy of any token. The secret lives only in the relay's settings.

## What you need

- A GitHub account.
- A free Cloudflare account ([cloudflare.com](https://www.cloudflare.com/)).
- Node.js on your computer, for the Cloudflare command line tool.
- About 20 minutes.

## 1. Make the GitHub App

Use a **GitHub App**, not an OAuth App. An OAuth App can only ask for access to all of someone's private repos. A GitHub App is installed on the repos the person picks, and only has the permission you give it.

On github.com open *Settings, Developer settings, GitHub Apps, New GitHub App*. Fill in:

| Field | Value |
|---|---|
| GitHub App name | A unique name, for example `Go Find Yourself`. It becomes the app's address: `github.com/apps/<slug>`. Note the slug. |
| Homepage URL | Your site, for example `https://barton-muller.github.io/find-your-self/` |
| Callback URL | The same address, with the trailing `/`. You can add more, one per site that will use it. |
| Expire user authorization tokens | Ticked (the default) |
| Request user authorization (OAuth) during installation | Ticked |
| Webhook, Active | Unticked |
| Repository permissions, Contents | **Read and write** |
| Where can this GitHub App be installed | *Any account* if other people should use it, or *Only on this account* while testing |

Press *Create GitHub App*. On the app's page:
1. Copy the **Client ID**. It is public.
2. Under *Client secrets* press *Generate a new client secret* and copy it now. GitHub shows it once. Keep it for step 2. Never put it in the app's code or in the repo.

## 2. Deploy the relay

The relay code is in [`worker/`](../worker). From the repo folder:

```
cd worker
npx wrangler login
```

Edit `wrangler.toml`:
- `GITHUB_CLIENT_ID`: the Client ID from step 1.
- `ALLOWED_ORIGINS`: the address of your site without a path, for example `https://barton-muller.github.io`. Separate several sites with commas. The relay refuses requests from any other site.

Then store the secret and deploy:

```
npx wrangler secret put GITHUB_CLIENT_SECRET     # paste the secret when asked
npx wrangler deploy
```

The deploy prints the relay's address, something like `https://gfy-github-auth.your-name.workers.dev`. To check the code first, run `node test.mjs` in `worker/`. It uses a pretend GitHub.

## 3. Tell the app about it

The three values are public. Add them as **variables** (not secrets) in your repo: *Settings, Secrets and variables, Actions, Variables*.

| Variable | Value |
|---|---|
| `VITE_GH_CLIENT_ID` | the Client ID |
| `VITE_GH_RELAY` | the relay address, without a trailing `/` |
| `VITE_GH_APP_SLUG` | the app's slug |

Run the *Deploy* workflow again (or push to `main`). The deploy workflow passes the variables to the build. If you would rather not use variables, put the three values in `src/brand.ts` under `auth`.

## 4. Try it

1. Open the app, *Settings*, step 3, and press **Sign in with GitHub**. Approve.
2. The app shows "Signed in as ...". Press **Add a repo**, install the app on a private repo, come back and press **Refresh list**.
3. Tap the repo. The app starts syncing to it.

## More apps on the same storage

The relay and the GitHub App are not tied to one app.
- Add each new site to `ALLOWED_ORIGINS` and run `npx wrangler deploy` again.
- Add the site's address as another *Callback URL* on the GitHub App (it allows several).
- Give the new app the same three `VITE_GH_*` values.

Each app then signs people in with the same account and can use the same repo, so several apps can share one storage repo. Keep each app's files in its own folder in the repo.

## Good to know

- **No invite links for signed-in people.** An access token from sign-in expires after 8 hours, so it cannot go in a link. On another device the person signs in again. Invite links still work for people who connect with a token. A friend without a GitHub account can only use those.
- **AI agents.** The *Copy for AI* text for a signed-in person has no token. Their agent uses their own GitHub login, for example after `gh auth login`.
- **Revoking.** A person can remove the app under their GitHub settings, *Applications*. To cut everyone off at once, regenerate the client secret in the GitHub App and run `npx wrangler secret put GITHUB_CLIENT_SECRET` again.
- **Cost.** The relay makes two small calls per person per 8 hours. That fits Cloudflare's free tier, but check Cloudflare's current limits.
- **Privacy.** Tokens pass through the relay once. It does not store or log them. If you change its code, keep it that way.

## If something fails

| What you see | Likely cause |
|---|---|
| No **Sign in with GitHub** button | The three values are not set, or the site was not rebuilt after setting them |
| "Sign-in failed: origin_not_allowed" | The site's address is not in `ALLOWED_ORIGINS` (scheme and host only, no path) |
| "Sign-in failed: redirect_not_allowed" | Same cause |
| GitHub says the redirect URI is not valid | The *Callback URL* in the GitHub App does not match the site's address exactly, including the trailing `/` |
| "Sign-in failed: bad_verification_code" | The code was already used or expired. Try again |
| The repo list is empty | The app is not installed on any repo yet. Use **Add a repo**, then **Refresh list** |
| Sync says "Signed out of GitHub" | The refresh token expired (after about six months) or the app was removed. Sign in again |
