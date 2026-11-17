import { useEffect, useMemo, useRef, useState } from 'react';
import { diffDays } from '../dates';
import { overviewCount, planPts, prefetchOverview } from '../tiles';
import { configured } from '../sync';
import { useStore } from '../store';
import { Icon, type IconName } from '../icons';
import { copyText, weatherReport } from '../weather';
import { BRAND } from '../brand';
import type { Plan, SyncConfig } from '../types';

function Sec({ id, num, icon, title, hint, children }: { id?: string; num?: number; icon: IconName; title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section id={id} className="card sec">
      <div className="sec-head">
        {num ? <span className="num">{num}</span> : <Icon name={icon} size={20} className="ico" />}
        <h3>{title}</h3>
        {hint && (
          <button type="button" className="qbtn" aria-label="What is this?" aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name="help" size={20} />
          </button>
        )}
      </div>
      {open && hint && <div className="hint">{hint}</div>}
      {children}
    </section>
  );
}

export function Settings() {
  const { setMeta, cfg, saveCfg, sync, syncNow, plan, replacePlan, resetSeed } = useStore();
  const [c, setC] = useState<SyncConfig>(cfg ?? { token: '', repo: '', path: 'plan.json', branch: 'main' });
  const file = useRef<HTMLInputElement>(null);
  const [tiles, setTiles] = useState<string>('');
  const [wx, setWx] = useState('');
  const [wxText, setWxText] = useState('');
  const pts = useMemo(() => planPts(plan), [plan]);
  const copyWeather = async () => {
    setWx('Fetching…');
    setWxText('');
    try {
      const t = await weatherReport(plan);
      if (await copyText(t)) setWx(`Copied (${t.split('\n').length} lines).`);
      else {
        setWx('Could not copy. Select the text below.');
        setWxText(t);
      }
    } catch (e) {
      setWx(`Failed: ${(e as Error).message}`);
    }
  };
  const refreshTiles = () =>
    overviewCount(pts).then((n) => setTiles(`${n.saved} of ${n.total} map tiles saved`)).catch(() => setTiles('Offline cache unavailable'));
  useEffect(() => { refreshTiles(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
  const goSync = () => document.getElementById('sync')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const nights = Math.max(diffDays(plan.start, plan.end), 0);
  const stIcon: IconName = sync.status === 'ok' ? 'check' : sync.status === 'error' ? 'alert' : sync.status === 'syncing' ? 'sync' : 'cloud';

  return (
    <div className="page set">
      <section className="card brandcard">
        <div className="brandrow">
          <img src="./icon.svg" width={48} height={48} alt="" />
          <div>
            <b>{BRAND.name}</b>
            <div className="small">{BRAND.tagline}</div>
          </div>
        </div>
        <div className="rowflex">
          <button className="primary ibtn" onClick={goSync}><Icon name="branch" size={18} /> Sync via GitHub</button>
          <a className="btnlink ibtn" href={BRAND.repo} target="_blank" rel="noreferrer"><Icon name="book" size={18} /> README</a>
        </div>
      </section>

      <Sec num={1} icon="calendar" title="Trip dates" hint="Set when the trip starts and ends. Dates for each stop follow from the nights you give it. You can change these any time, for example to add days at the end.">
        <div className="grid2">
          <label className="fld"><span className="fl"><Icon name="flag" size={16} /> Start</span>
            <input type="date" value={plan.start} onChange={(e) => e.target.value && setMeta({ start: e.target.value })} />
          </label>
          <label className="fld"><span className="fl"><Icon name="pin" size={16} /> End</span>
            <input type="date" value={plan.end} onChange={(e) => e.target.value && setMeta({ end: e.target.value })} />
          </label>
        </div>
        <p className="small">{nights} nights. You can always extend later.</p>
      </Sec>

      <Sec
        id="sync" num={2} icon="branch" title="Sync and AI agents"
        hint={<>
          Your trip is saved to a <b>private</b> GitHub repo that you own, using a token limited to that one repo (permission: Contents, read and write). The token stays on this device.
          An AI coding agent such as Claude Code can edit the same repo, so you can ask it to change your plan.
        </>}
      >
        <p className="lead">Keep your trip in a GitHub repo you own. Every device stays in step, and an AI agent can edit it for you.</p>
        <div className="guidelinks">
          <a className="ibtn" href={BRAND.syncGuide} target="_blank" rel="noreferrer"><Icon name="book" size={16} /> How to set up sync</a>
          <a className="ibtn" href={BRAND.tokenGuide} target="_blank" rel="noreferrer"><Icon name="lock" size={16} /> How to create a token</a>
        </div>
        <label className="fld"><span className="fl"><Icon name="repo" size={16} /> Repository</span>
          <input value={c.repo} onChange={set('repo')} placeholder="owner/trip-data" autoCapitalize="none" autoCorrect="off" />
        </label>
        <label className="fld"><span className="fl"><Icon name="lock" size={16} /> Token</span>
          <input type="password" value={c.token} onChange={set('token')} placeholder="github_pat_…" autoComplete="off" />
        </label>
        <details className="adv">
          <summary>Advanced</summary>
          <label className="fld"><span className="fl">File path</span><input value={c.path} onChange={set('path')} autoCapitalize="none" /></label>
          <label className="fld"><span className="fl">Branch</span><input value={c.branch} onChange={set('branch')} autoCapitalize="none" /></label>
        </details>
        <div className="rowflex">
          <button className="primary ibtn" disabled={!configured(c)} onClick={() => saveCfg(c)}><Icon name="sync" size={18} /> Save and sync</button>
          <button className="iconbtn" aria-label="Sync now" title="Sync now" disabled={!configured(cfg)} onClick={syncNow}><Icon name="sync" size={20} /></button>
          {cfg && <button className="iconbtn danger" aria-label="Disconnect" title="Disconnect" onClick={() => { saveCfg(null); setC({ ...c, token: '' }); }}><Icon name="x" size={20} /></button>}
        </div>
        <p className={`status s-${sync.status}`}>
          <Icon name={stIcon} size={16} className={sync.status === 'syncing' ? 'spin' : ''} />
          {sync.status === 'off' && 'Not synced. Data is on this device only.'}
          {sync.status === 'idle' && 'Waiting…'}
          {sync.status === 'syncing' && 'Syncing…'}
          {sync.status === 'ok' && `Synced ${sync.at ? new Date(sync.at).toLocaleTimeString() : ''}`}
          {sync.status === 'error' && `Error: ${sync.error}`}
        </p>
        <div className="wxline">
          <Icon name="sun" size={20} className="ico" />
          <button className="ibtn" onClick={copyWeather}><Icon name="copy" size={16} /> Copy forecast for AI</button>
          <span className="small">{wx || 'Or add a weather MCP connector to your AI tool.'}</span>
        </div>
        {wxText && <textarea readOnly value={wxText} rows={8} onFocus={(e) => e.currentTarget.select()} />}
      </Sec>

      <Sec icon="map" title="Offline map" hint="Saves the whole world at low detail and the area around your stops in more detail, so the map still works without a connection. Other areas are saved as you browse them.">
        <div className="rowflex">
          <button className="ibtn" onClick={() => { setTiles('Downloading…'); prefetchOverview(pts, true).then(refreshTiles); }}><Icon name="download" size={18} /> Download</button>
          <span className="small">{tiles}</span>
        </div>
      </Sec>

      <Sec icon="download" title="Backup" hint="Browsers can delete stored data, and iOS does so for sites you have not used for a while. Export a file now and then, or turn on sync.">
        <div className="rowflex">
          <button className="ibtn" onClick={exportJson}><Icon name="download" size={18} /> Export</button>
          <button className="ibtn" onClick={() => file.current?.click()}><Icon name="upload" size={18} /> Import</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
      </Sec>

      <button className="danger ibtn resetbtn" onClick={() => confirm('Replace everything with the example trip?') && resetSeed()}>
        <Icon name="trash" size={18} /> Reset to example trip
      </button>

      <footer className="foot">
        <p>
          Built with AI (Claude), so expect rough edges. Free and open source: copy it and change it as you like.
          {' '}<a href={BRAND.guide} target="_blank" rel="noreferrer">Make your own copy</a>.
        </p>
        <p>
          Credits: weather and place search by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a>;
          map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors;
          rail lines from Natural Earth; road routes by OSRM. Build {__BUILD__}.
        </p>
      </footer>
    </div>
  );
}
