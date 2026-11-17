# Share a trip repo with friends and family

This page is for sharing with an invite link. If your friends have GitHub accounts and the site has "Sign in with GitHub" turned on ([setup](GITHUB-SIGN-IN.md)), they can sign in and use their own repos instead. Invite links are for people who do not.

Making a GitHub token is the hardest part of sync. If you plan trips for people who would give up at that step, you can do it once for all of them.

You set up one private repo and one token. Then you send each person a link. When they open it, their app is connected. They need no GitHub account and no token.

## How it works

- Each person gets their own branch in your repo, for example `u/maria`. A new branch starts from a branch called `template` if the repo has one (otherwise from the default branch). Keep `template` free of personal data: it should hold only the example trip, `AGENTS.md`, `scripts/plan.py` and empty notes files, like the [data template](../data-template). Their trips are saved there as `trips/<name>/plan.json`, so they don't overwrite each other's trips.
- The link contains the repo name, the token and the branch name. The part after the `#` in a link is never sent to any server, including GitHub Pages. It stays in the browser.
- The app asks before it joins. It shows the repo and branch and says that anyone with the link can read and change the repo.

## What this does not protect

The branches keep people tidy. They do not keep them out of each other's trips. The token works for the whole repo, so anyone who has a link can read and change every branch, and can delete files. A person who opens the link also holds the token in their browser.

That is fine for family and close friends. It is a poor fit for people you do not trust, and for anything secret.

What the token cannot do: it only works on this one repo. It cannot touch your other repos or your account.

## Set it up

1. Make a **private** repo for it, for example from the [data template](../data-template). Put the template files on a branch named `template` as well as on `main`: `git push origin main:template`. Every invitee's branch then starts with the agent rules and the validator. See [step 1 of the sync guide](SYNC-AND-AI.md#1-make-a-private-repo-from-the-template). Use a repo that holds nothing else, and do not use the repo that has your own trips on `main`: friends can read every branch.
2. [Make a fine-grained token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) for that repo only, with *Contents: Read and write*. Set the expiry to a date after the last trip you expect. GitHub allows at most a year.
3. In the app, open *Settings*. In step 3, enter the repo and token and press *Save and sync*. Step 3 then shows which repo you are syncing with, and step 4 appears.
4. Go to step 4, *Invite someone*. Type their name and tap the link button. Copy the link or share it. The link is long mostly because of the token, which cannot be shortened.
5. Send it to them privately, in a message to that person.

## What your friend does

- **Android:** tap the link and press *Join*. Then install the app from the browser menu.
- **iPhone and iPad:** installed apps and Safari keep separate storage, and links open in Safari. The simplest way: add the app to the Home Screen first, copy the link, open the installed app, then paste the link into *Settings*, step 3, *Got an invite link?*. The app then asks to join.

After that they make trips as usual. Their trips are saved to their branch. Their step 3 only says which repo they are syncing with. They can invite others from step 4 too, since the same link works for anyone who has it.

## Your own other devices

To connect another phone or computer of your own, open *Settings*, step 3, and tap *Copy link for another device*. Send the link to yourself and open it on the other device. It connects to the same repo and branch. Opening a link again on a device that is already connected skips the question and goes straight to your trips.

## Editing with an AI agent

A friend does not need their own repo or a GitHub account for this, but they do need an AI coding agent that works on files in a folder (Claude Code, for example) and git on their computer. The invite link holds everything the agent needs:

```
git clone --branch u/maria https://TOKEN@github.com/OWNER/REPO.git
```

- `u/maria` is the branch from the link, `OWNER/REPO` is the repo, and `TOKEN` is `github_pat_` followed by the last part of the link (the part after the third `~`).
- The clone contains `AGENTS.md`, which tells the agent how to edit a trip safely and to stay on that branch. Changes it pushes show up in the app on the next sync.
- The token ends up in the clone's `.git/config` in plain text, so treat that folder like the link.

You do not have to explain this by hand. In the app, *Settings*, step 3 has **Copy for AI agent** and step 4 has **Copy for their AI agent** next to the invite link. They copy a message with the repo, branch, token, the clone command, the working rules and a short description of the plan format, ready to paste into Claude Code or a similar tool. Send it to your friend together with the invite link. It contains the token, so send it privately.

This is a lot to ask of most friends. Two easier routes: ask the person who runs the repo to make the change for them (their agent can edit any branch), or use the app's own editing. A way to copy a trip as text for a chat assistant and paste the result back is not built yet.

## Keep it safe

- Do not post the link anywhere public, and do not put the token in a public repo or chat room. GitHub revokes tokens it finds in public repos.
- To stop everyone's access, delete the token on GitHub. Their apps keep their trips on the device but can no longer sync. Make a new token and new links to start again.
- Everything is in git history, so a file that was deleted by mistake can be restored from GitHub.
- Changes by different people to the same branch are merged per stop, newest edit wins, as with your own devices.
