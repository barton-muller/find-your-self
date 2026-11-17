# Share a trip repo with friends and family

Making a GitHub token is the hardest part of sync. If you plan trips for people who would give up at that step, you can do it once for all of them.

You set up one private repo and one token. Then you send each person a link. When they open it, their app is connected. They need no GitHub account and no token.

## How it works

- Each person gets their own branch in your repo, for example `u/maria`. Their trips are saved there as `trips/<name>/plan.json`, so they don't overwrite each other's trips.
- The link contains the repo name, the token and the branch name. The part after the `#` in a link is never sent to any server, including GitHub Pages. It stays in the browser.
- The app asks before it joins. It shows the repo and branch and says that anyone with the link can read and change the repo.

## What this does not protect

The branches keep people tidy. They do not keep them out of each other's trips. The token works for the whole repo, so anyone who has a link can read and change every branch, and can delete files. A person who opens the link also holds the token in their browser.

That is fine for family and close friends. It is a poor fit for people you do not trust, and for anything secret.

What the token cannot do: it only works on this one repo. It cannot touch your other repos or your account.

## Set it up

1. Make a **private** repo for it, for example from the [data template](../data-template). See [step 1 of the sync guide](SYNC-AND-AI.md#1-make-a-private-repo-from-the-template). Use a repo that holds nothing else.
2. [Make a fine-grained token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) for that repo only, with *Contents: Read and write*. Set the expiry to a date after the last trip you expect. GitHub allows at most a year.
3. In the app, open *Settings*. In step 3, enter the repo and token and press *Save and sync*.
4. Still in step 3, open *Invite someone*. Type their name and tap the link button. Copy the link or share it.
5. Send it to them privately, in a message to that person.

## What your friend does

- **Android:** tap the link and press *Join*. Then install the app from the browser menu.
- **iPhone and iPad:** installed apps and Safari keep separate storage, and links open in Safari. The simplest way: add the app to the Home Screen first, copy the link, open the installed app, then paste the link into *Settings*, step 3, *Got an invite link?* and press *Join*.

After that they make trips as usual. Their trips are saved to their branch.

## Keep it safe

- Do not post the link anywhere public, and do not put the token in a public repo or chat room. GitHub revokes tokens it finds in public repos.
- To stop everyone's access, delete the token on GitHub. Their apps keep their trips on the device but can no longer sync. Make a new token and new links to start again.
- Everything is in git history, so a file that was deleted by mistake can be restored from GitHub.
- Changes by different people to the same branch are merged per stop, newest edit wins, as with your own devices.
