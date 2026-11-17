import { useEffect, useMemo, useRef, useState } from 'react';
import { diffDays } from '../dates';
import { overviewCount, planPts, prefetchOverview } from '../tiles';
import { configured, listRemoteTrips, type RemoteTrip } from '../sync';
import { prettyName, slug, uniquePath } from '../trips';
import { inviteCode, makeInviteLink, parseInvite } from '../invite';
import { aiBrief } from '../aiBrief';
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
  const { setMeta, cfg, saveCfg, sync, syncNow, plan, replacePlan, resetSeed, trips, activeTrip, switchTrip, newTrip, renameTrip, archiveTrip, importTrip } = useStore();
  const [c, setC] = useState<SyncConfig>(cfg ?? { token: '', repo: '', path: 'plan.json', branch: 'main' });
  const file = useRef<HTMLInputElement>(null);
  const [tiles, setTiles] = useState<string>('');
  const [wx, setWx] = useState('');
  const [wxText, setWxText] = useState('');
  const pts = useMemo(() => planPts(plan), [plan]);
  const [remote, setRemote] = useState<RemoteTrip[]>([]);
  const [remoteMsg, setRemoteMsg] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [aiMsg, setAiMsg] = useState('');
  const [deviceLink, setDeviceLink] = useState('');
  const [pasted, setPasted] = useState('');
  const [pasteErr, setPasteErr] = useState('');
  const makeInvite = () => {
    if (!configured(cfg)) return;
    const branch = `u/${slug(inviteName || 'friend')}`;
    setInviteLink(makeInviteLink({ repo: cfg.repo, token: cfg.token, branch, name: inviteName.trim() || undefined }));
  };
  const copyBrief = async (b: Parameters<typeof aiBrief>[0]) => {
    setAiMsg((await copyText(aiBrief(b))) ? 'Copied. Paste it into your AI agent.' : 'Could not copy.');
    window.setTimeout(() => setAiMsg(''), 4000);
  };
  const joinFromPaste = (v: string) => {
    setPasted(v);
    const code = inviteCode(v);
    if (code && parseInvite(v)) { setPasteErr(''); location.hash = `#/join/${code}`; }
    else setPasteErr(v.trim() ? 'This is not a valid invite link.' : '');
  };
  const refreshRemote = () => {
    if (!configured(cfg)) { setRemote([]); setRemoteMsg(''); return; }
    setRemoteMsg('Checking the repo…');
    listRemoteTrips(cfg).then((r) => { setRemote(r); setRemoteMsg(''); }).catch((e) => setRemoteMsg(String(e.message ?? e)));
  };
  useEffect(refreshRemote, [cfg, sync.status === 'ok']); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = trips.list.filter((t) => !t.archived);
  const known = new Set(trips.list.map((t) => t.path));
  const remoteOnly = remote.filter((r) => !known.has(r.path));
  const tripPath = activeTrip.path ?? uniquePath(activeTrip.name, trips.list);
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
    a.download = `${slug(activeTrip.name)}.json`;
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

      <Sec
        num={1} icon="flag" title="Your trip"
        hint={<>Name your trip, or pick another one. Each trip is saved separately on this device. With sync on, each trip is also saved in your repo as <code>trips/&lt;name&gt;/plan.json</code>, and trips from your other devices show up here.</>}
      >
        <label className="fld"><span className="fl"><Icon name="flag" size={16} /> Name</span>
          <input value={activeTrip.name} onChange={(e) => renameTrip(activeTrip.id, e.target.value)} placeholder="Name your trip" />
        </label>
        <ul className="triplist">
          {visible.map((t) => (
            <li key={t.id} className={t.id === trips.active ? 'on' : ''}>
              <button className="tripbtn" onClick={() => switchTrip(t.id)}>
                <Icon name={t.id === trips.active ? 'check' : 'pin'} size={18} /> <span>{t.name || 'Untitled trip'}</span>
              </button>
              {t.id !== trips.active && (
                <button className="iconbtn sm" aria-label={`Archive ${t.name}`} title="Archive (hide on this device)" onClick={() => confirm(`Hide "${t.name}" on this device? Its file in the repo stays.`) && archiveTrip(t.id)}>
                  <Icon name="archive" size={18} />
                </button>
              )}
            </li>
          ))}
          {remoteOnly.map((r) => (
            <li key={r.path} className="remote">
              <button className="tripbtn" onClick={async () => { const err = await importTrip(prettyName(r.name), r.path); if (err) alert(err); }}>
                <Icon name="cloud" size={18} /> <span>{prettyName(r.name)}</span> <small>in your repo</small>
              </button>
              <span className="iconbtn sm ghost"><Icon name="download" size={18} /></span>
            </li>
          ))}
          <li>
            {adding ? (
              <form className="newtrip" onSubmit={(e) => { e.preventDefault(); newTrip(newName); setNewName(''); setAdding(false); }}>
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name of the new trip" />
                <button className="primary iconbtn" type="submit" aria-label="Create trip"><Icon name="check" size={20} /></button>
                <button className="iconbtn" type="button" aria-label="Cancel" onClick={() => setAdding(false)}><Icon name="x" size={20} /></button>
              </form>
            ) : (
              <button className="tripbtn add" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> <span>New trip</span></button>
            )}
          </li>
        </ul>
        {remoteMsg && <p className="small">{remoteMsg}</p>}
        {!configured(cfg) && <p className="small">Trips saved in your repo appear here once sync is set up in step 3.</p>}
      </Sec>

      <Sec num={2} icon="calendar" title="Trip dates" hint="Set when this trip starts and ends. Dates for each stop follow from the nights you give it. You can change these any time, for example to add days at the end.">
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
        id="sync" num={3} icon="branch" title="Sync and AI agents"
        hint={<>
          Your trips are saved to a <b>private</b> GitHub repo, using a token limited to that one repo (permission: Contents, read and write). The token stays on this device.
          An AI coding agent such as Claude Code can edit the same repo, so you can ask it to change your plan.
        </>}
      >
        {configured(cfg) ? (
          <>
            <div className="syncsum">
              <Icon name="repo" size={22} className="ico" />
              <div>
                <div>Syncing with <b>{cfg.repo}</b></div>
                <div className="small">Branch <code>{cfg.branch}</code>. This trip is saved as <code>{tripPath}</code>.</div>
              </div>
            </div>
            <p className={`status s-${sync.status}`}>
              <Icon name={stIcon} size={16} className={sync.status === 'syncing' ? 'spin' : ''} />
              {sync.status === 'idle' && 'Waiting…'}
              {sync.status === 'syncing' && 'Syncing…'}
              {sync.status === 'ok' && `Synced ${sync.at ? new Date(sync.at).toLocaleTimeString() : ''}`}
              {sync.status === 'error' && `Error: ${sync.error}`}
              {sync.status === 'off' && 'Not synced.'}
            </p>
            <div className="rowflex">
              <button className="ibtn" onClick={syncNow}><Icon name="sync" size={18} /> Sync now</button>
              <button className="iconbtn danger" aria-label="Disconnect" title="Disconnect" onClick={() => { saveCfg(null); setC({ ...c, token: '' }); }}><Icon name="x" size={20} /></button>
            </div>
            <div className="rowflex ailine">
              <button className="ibtn" onClick={() => copyBrief({ repo: cfg.repo, token: cfg.token, branch: cfg.branch, trip: activeTrip.name, path: tripPath })}>
                <Icon name="sparkle" size={18} /> Copy for AI agent
              </button>
              <span className="small">{aiMsg || 'Repo, branch, token and instructions for Claude Code or similar. Contains your token.'}</span>
            </div>
            <details className="adv">
              <summary><Icon name="link" size={15} /> Set up another device of yours</summary>
              <p className="small">Make a link that connects your phone, tablet or computer to this same repo and branch. Open it there and press Join. It contains your token, so send it only to yourself.</p>
              <div className="rowflex">
                <button className="ibtn" onClick={() => setDeviceLink(makeInviteLink({ repo: cfg.repo, token: cfg.token, branch: cfg.branch }))}><Icon name="link" size={16} /> Make link</button>
              </div>
              {deviceLink && (
                <>
                  <input className="linkout" readOnly value={deviceLink} onFocus={(e) => e.currentTarget.select()} />
                  <div className="rowflex">
                    <button className="ibtn" onClick={() => copyText(deviceLink)}><Icon name="copy" size={16} /> Copy</button>
                    {typeof navigator.share === 'function' && <button className="ibtn" onClick={() => navigator.share({ title: 'Go Find Yourself: connect this device', url: deviceLink }).catch(() => {})}><Icon name="upload" size={16} /> Share</button>}
                  </div>
                </>
              )}
            </details>
            <p className="small">
              Want a repo of your own? <a href={BRAND.syncGuide} target="_blank" rel="noreferrer">How to set one up</a>.
            </p>
            <details className="adv">
              <summary>Change connection</summary>
              <label className="fld"><span className="fl"><Icon name="repo" size={16} /> Repository</span>
                <input value={c.repo} onChange={set('repo')} placeholder="owner/trip-data" autoCapitalize="none" autoCorrect="off" />
              </label>
              <label className="fld"><span className="fl"><Icon name="lock" size={16} /> Token</span>
                <input type="password" value={c.token} onChange={set('token')} placeholder="github_pat_…" autoComplete="off" />
              </label>
              <label className="fld"><span className="fl">Branch</span><input value={c.branch} onChange={set('branch')} autoCapitalize="none" /></label>
              <div className="rowflex"><button className="primary ibtn" disabled={!configured(c)} onClick={() => saveCfg(c)}><Icon name="sync" size={18} /> Save and sync</button></div>
            </details>
          </>
        ) : (
          <>
            <p className="lead">Keep your trips in a GitHub repo you own. Every device stays in step, and an AI agent can edit them for you.</p>
            <div className="guidelinks">
              <a className="ibtn" href={BRAND.syncGuide} target="_blank" rel="noreferrer"><Icon name="book" size={16} /> How to set up sync</a>
              <a className="ibtn" href={BRAND.tokenGuide} target="_blank" rel="noreferrer"><Icon name="lock" size={16} /> How to create a token</a>
            </div>
            <label className="fld"><span className="fl"><Icon name="link" size={16} /> Got an invite link? Paste it here</span>
              <input value={pasted} onChange={(e) => joinFromPaste(e.target.value)} placeholder="https://…#/j/…" autoCapitalize="none" autoCorrect="off" />
              {pasteErr && <span className="small err">{pasteErr}</span>}
            </label>
            <label className="fld"><span className="fl"><Icon name="repo" size={16} /> Repository</span>
              <input value={c.repo} onChange={set('repo')} placeholder="owner/trip-data" autoCapitalize="none" autoCorrect="off" />
            </label>
            <label className="fld"><span className="fl"><Icon name="lock" size={16} /> Token</span>
              <input type="password" value={c.token} onChange={set('token')} placeholder="github_pat_…" autoComplete="off" />
            </label>
            <details className="adv">
              <summary>Advanced</summary>
              <label className="fld"><span className="fl">Branch</span><input value={c.branch} onChange={set('branch')} autoCapitalize="none" /></label>
            </details>
            <div className="rowflex">
              <button className="primary ibtn" disabled={!configured(c)} onClick={() => saveCfg(c)}><Icon name="sync" size={18} /> Save and sync</button>
            </div>
            <p className={`status s-${sync.status}`}>
              <Icon name={stIcon} size={16} />
              Not synced. Data is on this device only.
            </p>
          </>
        )}
        <div className="wxline">
          <Icon name="sun" size={20} className="ico" />
          <button className="ibtn" onClick={copyWeather}><Icon name="copy" size={16} /> Copy forecast for AI</button>
          <span className="small">{wx || 'Or add a weather MCP connector to your AI tool.'}</span>
        </div>
        {wxText && <textarea readOnly value={wxText} rows={8} onFocus={(e) => e.currentTarget.select()} />}
      </Sec>

      {configured(cfg) && (
        <Sec
          num={4} icon="link" title="Invite someone"
          hint="Make a link that sets up sync on another person's device, using this repo. They get their own branch, so their trips are saved separately, and they need no GitHub account. Anyone with the link can read and change everything in the repo."
        >
          <div className="newtrip">
            <input value={inviteName} onChange={(e) => { setInviteName(e.target.value); setInviteLink(''); }} placeholder="Their name" />
            <button className="primary iconbtn" aria-label="Create invite link" onClick={makeInvite}><Icon name="link" size={20} /></button>
          </div>
          {inviteLink && (
            <>
              <input className="linkout" readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} />
              <div className="rowflex">
                <button className="ibtn" onClick={() => copyText(inviteLink)}><Icon name="copy" size={16} /> Copy</button>
                {typeof navigator.share === 'function' && <button className="ibtn" onClick={() => navigator.share({ title: 'Join my trips', url: inviteLink }).catch(() => {})}><Icon name="upload" size={16} /> Share</button>}
              </div>
              <div className="rowflex ailine">
                <button className="ibtn" onClick={() => copyBrief({ repo: cfg.repo, token: cfg.token, branch: `u/${slug(inviteName || 'friend')}` })}>
                  <Icon name="sparkle" size={16} /> Copy for their AI agent
                </button>
                <span className="small">{aiMsg}</span>
              </div>
              <p className="small">Send both privately. They contain the token.</p>
            </>
          )}
        </Sec>
      )}

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
