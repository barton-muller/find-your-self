import { storeFromUrl } from 'pages-storage/store';
import { useState } from 'react';
import { Icon } from '../icons';
import { repoUrl } from '../sync';
import type { SyncConfig } from '../types';

// One form for every connection with a token: the address of the repo on any git host (GitHub, GitLab, Codeberg, Forgejo, Gitea),
// an access token and, if it is not the default, a branch. The address can carry the token (https://token@host/group/name.git).
export function TokenConnect({ cfg, onSave, children }: { cfg: SyncConfig | null; onSave: (c: SyncConfig) => void; children?: React.ReactNode }) {
  const [url, setUrl] = useState(cfg?.repo ? repoUrl(cfg) : '');
  const [token, setToken] = useState(cfg?.token ?? '');
  const [branch, setBranch] = useState(cfg?.branch ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setErr('');
    setBusy(true);
    try {
      // This finds out which host it is, checks the repo and the token, and looks up the default branch. The errors say what is wrong.
      const store = await storeFromUrl(url, { token: token.trim() || undefined, branch: branch.trim() || undefined });
      const info = await store.repoInfo();
      if (info.canWrite === false) throw new Error('The token can read this repo but not write to it. Give it write access.');
      const address = new URL(url.trim());
      const repo = address.pathname.replace(/\/+$/, '').replace(/\.git$/, '').replace(/^\//, '');
      const github = address.hostname === 'github.com' || address.hostname === 'www.github.com';
      const secret = token.trim() || decodeURIComponent(address.password || address.username);
      onSave({ token: secret, repo, server: github ? undefined : address.origin, path: cfg?.path ?? 'plan.json', branch: store.branch ?? info.defaultBranch, dir: cfg?.dir });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <label className="fld"><span className="fl"><Icon name="link" size={16} /> Repository address</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/you/trip-data.git" autoCapitalize="none" autoCorrect="off" />
      </label>
      <label className="fld"><span className="fl"><Icon name="lock" size={16} /> Access token</span>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
      </label>
      <label className="fld"><span className="fl">Branch, empty for the default</span>
        <input value={branch} onChange={(e) => setBranch(e.target.value)} autoCapitalize="none" autoCorrect="off" />
      </label>
      {err && <p className="small err">{err}</p>}
      <div className="rowflex">
        <button className="primary ibtn" disabled={busy || !url.trim()} onClick={save}><Icon name="sync" size={18} /> {busy ? 'Checking…' : 'Save and sync'}</button>
        {children}
      </div>
    </>
  );
}
