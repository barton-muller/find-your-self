# Keep your trip in a GitHub repo, and let an AI edit it

This is optional. Without it, your trip lives in the browser on one device. With it, the trip is a file in a GitHub repo that you own. That gives you three things:

- The same trip on your phone, tablet and laptop.
- A backup with full history.
- A repo you can hand to an AI agent, such as Claude Code, so it can change the plan for you. For example: "Add two nights in Hanoi after Ninh Binh and check that the dates still work."

Your trips never go through a server of ours. The app talks straight to GitHub.

There are two ways to connect: **sign in with GitHub** (if the site you use has it turned on, which is the easiest), or a **token** you make yourself. Both end the same way: the app saves your trips to a repo.

## What you need

- A free GitHub account.
- Ten minutes.

## Easiest: sign in with GitHub

If *Settings*, step 3 shows **Sign in with GitHub**:
1. Make a private repo (step 1 below) with at least one file in it.
2. Press **Sign in with GitHub** and approve.
3. Press **Add a repo**, install the app on your repo, and come back. Press **Refresh list** and tap your repo.

That is all. You can skip step 2 below. Signed-in devices repeat the sign-in. Invite links and the token in *Copy for AI* do not apply (see the [friends guide](FRIENDS.md)); your agent uses your own GitHub login instead.

If you do not see the button, use a token as described next.

## 1. Make a private repo from the template

The folder [`data-template`](../data-template) in this repo is a ready-to-use data repo. It holds an example trip in `trips/example-trip/`, rules for AI agents, notes files for your decisions and a script that checks the plans. Each trip lives in its own folder, `trips/<name>/plan.json`.

With the GitHub command line (`gh`):

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

Without the command line: create a new **private** repo on GitHub, then use *Add file, Upload files* to upload the contents of `data-template`. `CLAUDE.md` is only a pointer to `AGENTS.md`, so you can skip it.

**Keep it private.** `plan.json` holds your dates, places and booking notes. A public repo can be found and read by anyone. The template itself is public and has no personal data in it, so it is safe to share. Your own data repo is not.

## 2. Make a token that can only touch that repo (without sign-in)

The app needs a key to write to your repo. GitHub calls it a fine-grained personal access token. GitHub's own steps are here: [Creating a fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token).

Use these settings:

| Setting | Value |
|---|---|
| Repository access | Only select repositories, then pick your data repo |
| Repository permissions, Contents | Read and write |
| Expiration | A date after your trip ends |

Copy the token when GitHub shows it (it starts with `github_pat_`). GitHub shows it once.

The token is saved in the browser on the device where you paste it. It is not sent anywhere except to GitHub. If you lose the device, delete the token on GitHub and make a new one.

## 3. Connect the app

Open the app, then *Settings*. The steps there are in order:

1. **Your trip.** Name your trip, or pick one you already have. You can keep several trips on the device, with or without sync.
2. **Trip dates.**
3. **Sync and AI agents.** Open *Use a token or invite link instead* and enter:
   - **Repository**: `your-username/my-trip-data`
   - **Token**: the one you just made

Press *Save and sync*. Do the same on each device. The app syncs when you open it and when you come back to it from another app.

**Several trips.** Each trip is saved in the repo as `trips/<name>/plan.json`, chosen when the trip is first synced. The trip list in step 1 also shows trips that are in the repo but not on this device yet. Tap one to download it. Use *New trip* to start another one. Renaming a trip in the app does not rename its folder.

**Before the first sync, name your trip.** The first sync saves the trip you have open into the repo. If the repo already has the example trip from the template, and your trip is the unchanged example, they match and nothing is duplicated.

## 4. Point an AI agent at the repo

Clone the repo and open it in your agent:

```
git clone https://github.com/your-username/my-trip-data
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

| Message in the app | Likely cause |
|---|---|
| GitHub 401 | The token is wrong or has expired. Make a new one. |
| GitHub 403 | The token does not have *Contents: Read and write* on this repo. |
| GitHub 404 | The repo name or branch is wrong, or the token cannot see the repo. |
| Edits seem to be missing | Two devices changed the same stop before syncing. The later edit wins. Use *Undo* or check the repo history. |

If something goes badly wrong, the repo history has every earlier version of `plan.json`.
