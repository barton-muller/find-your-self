import { useRef, useState } from 'react';
import { configured } from '../sync';
import { useStore } from '../store';
import type { Plan, SyncConfig } from '../types';

export function Settings() {
  const { cfg, saveCfg, sync, syncNow, plan, replacePlan, resetSeed } = useStore();
  const [c, setC] = useState<SyncConfig>(cfg ?? { token: '', repo: '', path: 'plan.json', branch: 'main' });
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof SyncConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value.trim() });

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 1)], { type: 'application/json' }));
    a.download = 'trip-plan.json';
    a.click();
  };
  const importJson = async (f: File) => {
    try {
      const p = JSON.parse(await f.text()) as Plan;
      if (p.v !== 1 || !p.stops || !p.legs) throw new Error();
      if (confirm('Replace the current plan with this file?')) replacePlan({ ...p, metaUpdatedAt: Date.now() });
    } catch {
      alert('Not a valid plan file');
    }
  };

  return (
    <div className="page">
      <section className="card">
        <h2>GitHub sync</h2>
        <p className="muted">
          Stores the plan as a JSON file in a <b>private</b> GitHub repo, via a fine-grained token limited to that one repo
          (permission: Contents → read &amp; write). The token stays on this device only.
        </p>
        <label>Repository<input value={c.repo} onChange={set('repo')} placeholder="owner/trip-data" autoCapitalize="none" autoCorrect="off" /></label>
        <label>File path<input value={c.path} onChange={set('path')} autoCapitalize="none" /></label>
        <label>Branch<input value={c.branch} onChange={set('branch')} autoCapitalize="none" /></label>
        <label>Token<input type="password" value={c.token} onChange={set('token')} placeholder="github_pat_…" autoComplete="off" /></label>
        <div className="rowflex">
          <button className="primary" disabled={!configured(c)} onClick={() => saveCfg(c)}>Save &amp; sync</button>
          <button disabled={!configured(cfg)} onClick={syncNow}>Sync now</button>
          {cfg && <button className="danger" onClick={() => { saveCfg(null); setC({ ...c, token: '' }); }}>Disconnect</button>}
        </div>
        <p className={`status s-${sync.status}`}>
          {sync.status === 'off' && 'Sync off — data is stored on this device only.'}
          {sync.status === 'idle' && 'Waiting…'}
          {sync.status === 'syncing' && 'Syncing…'}
          {sync.status === 'ok' && `Synced ${sync.at ? new Date(sync.at).toLocaleTimeString() : ''}`}
          {sync.status === 'error' && `Error: ${sync.error}`}
        </p>
        <p className="muted">Merging is per stop and per connection, newest edit wins. Edits made on two devices to the same stop before syncing: the later one is kept.</p>
      </section>
      <section className="card">
        <h2>Backup</h2>
        <div className="rowflex">
          <button onClick={exportJson}>Export JSON</button>
          <button onClick={() => file.current?.click()}>Import JSON</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
        <p className="muted">iOS can clear web storage for sites unused for a while. Add this app to the Home Screen and keep sync on or export occasionally.</p>
      </section>
      <section className="card">
        <h2>Reset</h2>
        <button className="danger" onClick={() => confirm('Replace everything with the example route?') && resetSeed()}>Reset to example route</button>
      </section>
    </div>
  );
}
