# Keep your trips in a git repo, and let an AI edit them

This is optional. Without it, your trip lives in the browser on one device. With it, each trip is a file in a git repo that you own, on GitHub, GitLab, Codeberg or any Forgejo or Gitea server. That gives you three things:

- The same trip on your phone, tablet and laptop.
- A backup with full history.
- A repo you can hand to an AI agent, such as Claude Code, so it can change the plan for you. For example: "Add two nights in Hanoi after Ninh Binh and check that the dates still work."

Your trips never go through a server of ours. The app talks straight to your git host.

There are two ways to connect: **sign in with GitHub** (if the site you use has it turned on, which is the easiest), or an **access token** you make yourself, which works with any supported host. Both end the same way: the app saves your trips to a repo.

## What you need

- A free account on a git host: GitHub, GitLab, Codeberg, or a Forgejo or Gitea server.
- Ten minutes.

## Easiest: sign in with GitHub

If *Settings*, step 3 shows **Sign in with GitHub**:
1. Press **Sign in with GitHub** and approve.
2. Press **New**. The app creates a private repo for you with the starter files your AI agent needs, and starts syncing. Or press **Add existing**, install the app on a repo you already have, come back, and tap the repo.

Your trips go in a `find-your-self/` folder of the repo, so the repo can hold other apps' data too. Repos that already have `trips/` in the root keep working as they are.

That is all. You can skip the steps below. Signed-in devices repeat the sign-in. Invite links and the token in *Copy for AI* do not apply (see the [friends guide](FRIENDS.md)); your agent uses your own GitHub login instead.

If you do not see the button, or you use another host, use a token as described next.

## 1. Make a private repo from the template

The folder [`data-template`](../data-template) in this repo is a ready-to-use data repo. It holds an example trip in `trips/example-trip/`, rules for AI agents, notes files for your decisions and a script that checks the plans. Each trip lives in its own folder, `trips/<name>/plan.json`.

With the GitHub command line (`gh`). On another host, make an empty private repo there and push to it the same way:

```
git clone https://github.com/barton-muller/find-your-self
mkdir my-trip-data
cp -a find-your-self/data-template/. my-trip-data/
cd my-trip-data
git init -b main
git add -A
git commit -m "Start trip data"
gh repo create my-trip-data --private --source . --push
```

Without the command line: create a new **private** repo on your host, then upload the contents of `data-template`. `CLAUDE.md` is only a pointer to `AGENTS.md`, so you can skip it.

**Keep it private.** `plan.json` holds your dates, places and booking notes. A public repo can be found and read by anyone. The repo also needs at least one commit (a README is enough) before the app can connect. The template itself is public and has no personal data in it, so it is safe to share. Your own data repo is not.

## 2. Make a token that can only touch that repo (without sign-in)

The app needs a key to write to your repo. Make it for that one repo, with write access and an expiry date after your trip ends.

**GitHub.** A fine-grained personal access token. GitHub's own steps: [Creating a fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token). Use these settings:

| Setting | Value |
|---|---|
| Repository access | Only select repositories, then pick your data repo |
| Repository permissions, Contents | Read and write |
| Expiration | A date after your trip ends |

Copy the token when GitHub shows it (it starts with `github_pat_`). GitHub shows it once.

**GitLab.** A project access token (or a personal one) with the `api` scope and the *Developer* role or higher. GitLab creates commits through its API, which needs that scope.

**Codeberg, Forgejo and Gitea.** An access token with read and write access to repositories, from *Settings, Applications*.

The token is saved in the browser on the device where you paste it. It is not sent anywhere except to your git host. If you lose the device, delete the token on the host and make a new one.

## 3. Connect the app

Open the app, then *Settings*. The steps there are in order:

1. **Your trip.** Name your trip, or pick one you already have. You can keep several trips on the device, with or without sync.
2. **Trip dates.**
3. **Sync data to a git repo.** Open **Advanced: connect with a token** (or **Change connection** if you are connected already) and enter:
   - **Repository address**: the address you would use for `git clone`, for example `https://github.com/you/my-trip-data.git`, `https://gitlab.com/you/my-trip-data.git` or `https://codeberg.org/you/my-trip-data.git`. GitLab addresses with subgroups work (`https://gitlab.com/group/sub/project.git`). You may also write `you/my-trip-data` for GitHub, or put the token in front of the host (`https://TOKEN@host/you/repo.git`).
   - **Access token**: the one you just made.
   - **Branch**: leave empty to use the repo's default branch.

Press *Save and sync*. The app finds out which kind of host it is, checks the repo and the token, and says what is wrong if something is. Do the same on each device. The app syncs when you open it and when you come back to it from another app.

**Hosts that work.** github.com, gitlab.com and codeberg.org are known. For any other server the app asks which API it speaks (GitLab, or Forgejo and Gitea). The server must allow web pages to call its API (GitHub, GitLab.com and Codeberg do; on your own server turn on CORS for the site). A copy of the app that you host yourself must also allow your server in its Content Security Policy: build it with `VITE_CSP_CONNECT="https://git.example.org"`. Invite links do not carry the server, so they are offered for GitHub repos only.

**Several trips.** Each trip is saved in the repo as `trips/<name>/plan.json`, chosen when the trip is first synced. The trip list in step 1 also shows trips that are in the repo but not on this device yet. Tap one to download it. Use *New trip* to start another one. Renaming a trip in the app does not rename its folder.

**Before the first sync, name your trip.** The first sync saves the trip you have open into the repo. If the repo already has the example trip from the template, and your trip is the unchanged example, they match and nothing is duplicated.

## 4. Point an AI agent at the repo

Clone the repo and open it in your agent:

```
git clone https://github.com/your-username/my-trip-data   # or the address on your host
cd my-trip-data
claude
```

The agent reads `AGENTS.md`, which tells it how to edit the plan safely, and `DECISIONS.md`, which holds your preferences. Fill in `DECISIONS.md` first. The more it knows about how you like to travel, the better its suggestions.

Things you can ask:
- "Add three nights in Hanoi after Ninh Binh. Pick a train for the leg."
- "I only have 14 days. What can I cut?"
- "Look up the train times from Luang Prabang to Vientiane and put them in the notes."
- "Check the plan and tell me what is still unbooked."

The agent saves its changes with git. The app picks them up the next time it syncs. Changes you make in the app reach the repo within a few seconds, so tell the agent to `git pull` before it starts.

## Friends and family

If the people you plan with cannot make a token, you can set sync up once and send them links. See [Share a trip repo with friends and family](FRIENDS.md).

## Fixing problems

The app says what went wrong, in words. The common ones:

| Message in the app | Likely cause |
|---|---|
| *… rejected the token (expired or wrong)* | The token is wrong or has expired. Make a new one. |
| *… refused … The token may lack permission* | The token cannot write to this repo: GitHub needs *Contents: Read and write*, GitLab the `api` scope, Codeberg write access to repositories. |
| *… could not find it … Check the repo address* | The address is wrong, or the token cannot see the repo. |
| *Could not reach … (CORS)* | The address is wrong, there is no connection, or the server does not allow web pages to call its API. |
| *Could not tell what kind of git host … is* | The server is not GitHub, GitLab, Forgejo or Gitea, or it answers on a different address. |
| *… answered … in a way this adapter does not understand* | The host changed its API. The message names the call. This needs a fix in the app: please report it. |
| *Add a first commit (a README) on …, then connect* | The repo is empty. Add a README on the host and try again. |
| Edits seem to be missing | Two devices changed the same stop before syncing. The later edit wins. Use *Undo* or check the repo history. |

If something goes badly wrong, the repo history has every earlier version of `plan.json`.
