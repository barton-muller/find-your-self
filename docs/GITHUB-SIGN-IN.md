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
- About 20 minutes. It can all be done from a phone browser.

## 1. Set up the relay and the GitHub App

The relay and the GitHub App live in their own repo, because they are general and any app can share them: **[github-auth-relay](https://github.com/barton-muller/github-auth-relay)**. Its README has the full steps:
1. Make a GitHub App (the exact fields are listed there) and keep its Client ID and client secret.
2. Fork the repo and deploy it to Cloudflare. In the dashboard, *Workers & Pages, Create, Import a repository* does it from a phone. Put the client secret in the Worker as a **Secret**, never in a repo.
3. Note the Worker's address and the GitHub App's slug.

If you use one account's GitHub Pages for several apps, add `https://<you>.github.io/` as one callback URL with wildcard matching on, and `https://<you>.github.io` as the relay's `ALLOWED_ORIGINS`. That covers every app.

## 2. Tell the app about it

The three values are public. Add them as **variables** (not secrets) in your repo: *Settings, Secrets and variables, Actions, Variables*.

| Variable | Value |
|---|---|
| `VITE_GH_CLIENT_ID` | the Client ID |
| `VITE_GH_RELAY` | the relay address, without a trailing `/` |
| `VITE_GH_APP_SLUG` | the app's slug |

Run the *Deploy* workflow again (or push to `main`). The deploy workflow passes the variables to the build. If you would rather not use variables, put the three values in `src/brand.ts` under `auth`.

## 3. Try it

1. Open the app, *Settings*, step 3, and press **Sign in with GitHub**. Approve.
2. The app shows "Signed in as ...". Press **Add a repo**, install the app on a private repo, come back and press **Refresh list**.
3. Tap the repo. The app starts syncing to it.

## More apps on the same storage

The relay and the GitHub App are not tied to one app.
- Add each new site to the relay's `ALLOWED_ORIGINS` and redeploy (one entry per origin covers every page under it).
- Add the site's address as another *Callback URL* on the GitHub App, unless wildcard matching already covers it.
- Give the new app the same three `VITE_GH_*` values.

Each app signs people in with the same account. Two points to know:
- **One sign-in for all your sites on one address.** The sign-in token is kept under a shared name, so signing in on one site signs you in on the others at `you.github.io`. Each site still picks its own repo.
- **Give every app its own `storage` name** in `src/brand.ts` (this app uses `gfy`). Browser storage is shared by all pages on one address, so without a different name two apps would overwrite each other's trips and repo choice. Only the sign-in token is shared on purpose.

The GitHub App has access to every repo it is installed on, and the token works on all of them. Each app only uses the repo it picked, but nothing stops its code from reaching the others. For hard separation, make a separate GitHub App per app.

## Good to know

- **No invite links for signed-in people.** An access token from sign-in expires after 8 hours, so it cannot go in a link. On another device the person signs in again. Invite links still work for people who connect with a token. A friend without a GitHub account can only use those.
- **AI agents.** The *Copy for AI* text for a signed-in person has no token. Their agent uses their own GitHub login, for example after `gh auth login`.
- **Revoking.** A person can remove the app under their GitHub settings, *Applications*. To cut everyone off at once, regenerate the client secret in the GitHub App and update the `GITHUB_CLIENT_SECRET` secret in Cloudflare.
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
