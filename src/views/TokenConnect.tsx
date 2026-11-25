import { useState } from 'react';
import { Icon } from '../icons';
import { defaultBranch, parseRepoUrl, repoUrl } from '../sync';
import type { SyncConfig } from '../types';

// One form for every connection with a token: the address of the repo on any git host, an access token and, if it is not
// the default, a branch. The address can carry the token (https://token@host/owner/name.git).
export function TokenConnect({ cfg, onSave, children }: { cfg: SyncConfig | null; onSave: (c: SyncConfig) => void; children?: React.ReactNode }) {
  const [url, setUrl] = useState(cfg?.repo ? repoUrl(cfg) : '');
  const [token, setToken] = useState(cfg?.token ?? '');
  const [branch, setBranch] = useState(cfg?.branch ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const parsed = parseRepoUrl(url);
    if (!parsed) return setErr('Enter the repo address, for example https://github.com/you/trip-data.git');
    const t = token.trim() || parsed.token || '';
    if (!t) return setErr('Enter an access token.');
    setErr('');
    setBusy(true);
    try {
      const c: SyncConfig = { token: t, repo: parsed.repo, server: parsed.server, path: cfg?.path ?? 'plan.json', branch: branch.trim(), dir: cfg?.dir };
      if (!c.branch) c.branch = await defaultBranch(c);
      onSave(c);
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
