import { useEffect, useMemo, useRef, useState } from 'react';
import { diffDays } from '../dates';
import { overviewCount, planPts, prefetchOverview } from '../tiles';
import { configured, listRemoteTrips, type RemoteTrip } from '../sync';
import { prettyName, slug, uniquePath } from '../trips';
import { inviteCode, makeInviteLink, parseInvite } from '../invite';
import { aiBrief } from '../aiBrief';
import { createDataRepo, pushStarterFiles } from '../dataRepo';
import { authAvailable, installUrl, listRepos, rememberReturn, type RepoChoice } from '../auth';
import { useStore } from '../store';
import { GithubMark, Icon, type IconName } from '../icons';
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
  const { setMeta, cfg, saveCfg, sync, syncNow, plan, replacePlan, resetSeed, trips, activeTrip, switchTrip, newTrip, renameTrip, archiveTrip, importTrip, auth, authError, signIn, signOut, chooseRepo, effCfg } = useStore();
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
  const copyLink = async (link: string, ok: string) => {
    setAiMsg((await copyText(link)) ? ok : 'Could not copy.');
    window.setTimeout(() => setAiMsg(''), 5000);
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
    effCfg().then((c) => (c ? listRemoteTrips(c) : [])).then((r) => { setRemote(r); setRemoteMsg(''); }).catch((e) => setRemoteMsg(String(e.message ?? e)));
  };
  const [repos, setRepos] = useState<RepoChoice[] | null>(null);
  const [repoMsg, setRepoMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const loadRepos = () => {
    setRepoMsg('Looking for your repos…');
    listRepos()
      .then((r) => { setRepos(r); setRepoMsg(''); }).catch((e) => setRepoMsg(String(e.message ?? e)));
  };
  const makeRepo = async () => {
    setCreating(true);
    setRepoMsg('Creating a private repo…');
    try {
      const r = await createDataRepo();
      if (!r.ready) { setRepoMsg(`Created ${r.full}, but the app cannot reach it yet. Tap Add existing and select it.`); loadRepos(); return; }
      await chooseRepo(r.full, r.branch, `${BRAND.folder}/`);
      setRepoMsg('');
      // the plan syncs first; the starter files for an AI agent follow in the background
      setAiMsg('Adding the starter files for your AI agent…');
      pushStarterFiles(r.full, r.branch)
        .then(() => { setAiMsg('Starter files added.'); window.setTimeout(() => setAiMsg(''), 4000); })
        .catch((e: Error) => setAiMsg(`Could not add the starter files: ${e.message}`));
    } catch (e) {
      setRepoMsg(String((e as Error).message ?? e));
    } finally {
      setCreating(false);
    }
  };
  useEffect(() => { if (auth && !configured(cfg)) loadRepos(); }, [auth, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const nights = Math.max(diffDays(plan.start, plan.end), 0);
  const stIcon: IconName = sync.status === 'ok' ? 'check' : sync.status === 'error' ? 'alert' : sync.status === 'syncing' ? 'sync' : 'cloud';

  return (
    <div className="page set">
      <section className="card brandcard">
        <div className="brandrow">
          <img src="./icon.svg" width={48} height={48} alt="" />
          <div className="grow">
            <b>{BRAND.name}</b>
            <div className="small">{BRAND.tagline}</div>
          </div>
          <a className="iconbtn docs" href={BRAND.repo} target="_blank" rel="noreferrer" aria-label="Documentation (README)" title="Documentation (README)"><Icon name="bookopen" size={22} /></a>
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
        id="sync" num={3} icon="branch" title="Sync data to GitHub"
        hint={<>
          Your trips are saved to a <b>private</b> GitHub repo that you own, so every device stays in step. Sign in with GitHub, then pick a repo: <b>Add existing</b> lets the app use a repo you already have, and <b>New</b> creates a private one with the starter files an AI agent needs.
          An AI coding agent such as Claude Code can then edit the same repo, so you can ask it to change your plan. The sign-in stays on this device.
        </>}
      >
        {configured(cfg) ? (
          <>
            <div className="syncsum">
              <Icon name="repo" size={22} className="ico" />
              <div>
                <div>Syncing with <b>{cfg.repo}</b></div>
                {cfg.viaGitHub && auth && <div className="small">Signed in as <b>{auth.login}</b></div>}
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
            <div className="actgrid">
              <button className="ibtn" onClick={syncNow}><Icon name="sync" size={18} /> Sync now</button>
              <button className="ibtn" onClick={() => copyBrief({ repo: cfg.repo, token: cfg.viaGitHub ? undefined : cfg.token, branch: cfg.branch, trip: activeTrip.name, path: tripPath, dir: cfg.dir })}>
                <Icon name="sparkle" size={18} /> Copy for AI
              </button>
              {cfg.viaGitHub ? (
                <>
                  <button className="ibtn" onClick={() => saveCfg(null)}><Icon name="repo" size={18} /> Choose another repo</button>
                  <button className="ibtn danger" onClick={() => confirm('Sign out of GitHub on this device? Your trips stay here.') && signOut()}><Icon name="x" size={18} /> Sign out</button>
                </>
              ) : (
                <button className="ibtn wide" onClick={() => copyLink(makeInviteLink({ repo: cfg.repo, token: cfg.token, branch: cfg.branch }), 'Link copied. Open it on your other device and press Join.')}>
                  <Icon name="link" size={18} /> Copy link for another device
                </button>
              )}
            </div>
            {aiMsg && <p className="small">{aiMsg}</p>}
            {!cfg.viaGitHub && <details className="adv">
              <summary>Change connection</summary>
              <label className="fld"><span className="fl"><Icon name="repo" size={16} /> Repository</span>
                <input value={c.repo} onChange={set('repo')} placeholder="owner/trip-data" autoCapitalize="none" autoCorrect="off" />
              </label>
              <label className="fld"><span className="fl"><Icon name="lock" size={16} /> Token</span>
                <input type="password" value={c.token} onChange={set('token')} placeholder="github_pat_…" autoComplete="off" />
              </label>
              <label className="fld"><span className="fl">Branch</span><input value={c.branch} onChange={set('branch')} autoCapitalize="none" /></label>
              <div className="rowflex">
                <button className="primary ibtn" disabled={!configured(c)} onClick={() => saveCfg(c)}><Icon name="sync" size={18} /> Save and sync</button>
                <button className="ibtn danger" onClick={() => { saveCfg(null); setC({ ...c, token: '' }); }}><Icon name="x" size={18} /> Disconnect</button>
              </div>
            </details>}
          </>
        ) : authAvailable ? (
          <div className="signin">
            {authError && <p className="small err">{authError}</p>}
            {!auth ? (
              <button className="ghbtn" onClick={signIn}><GithubMark size={20} /> Sign in with GitHub</button>
            ) : (
              <>
                <p className="lead">Signed in as <b>{auth.login}</b></p>
                {repos && repos.length > 0 && (
                  <ul className="triplist">
                    {repos.map((r) => (
                      <li key={r.full}><button className="tripbtn" onClick={() => chooseRepo(r.full, r.branch)}><Icon name="repo" size={18} /> <span>{r.full}</span></button></li>
                    ))}
                  </ul>
                )}
                {repoMsg && <p className="small">{repoMsg}</p>}
                <div className="actgrid">
                  <a className="btnlink ibtn" href={installUrl()} onClick={rememberReturn} target="_blank" rel="noreferrer"><Icon name="plus" size={18} /> Add existing</a>
                  <button className="ibtn" disabled={creating} onClick={makeRepo}><Icon name="plus" size={18} /> New</button>
                  <button className="ibtn wide danger" onClick={signOut}><Icon name="x" size={18} /> Sign out</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}
      </Sec>

      <Sec icon="sun" title="Forecast for AI" hint="Copies the Open-Meteo forecast for every upcoming stop, at its planned dates, as text you can paste into an AI chat. You can also add a weather connector (MCP) to your AI tool.">
        <div className="actgrid">
          <button className="ibtn wide" onClick={copyWeather}><Icon name="copy" size={18} /> Copy forecast</button>
        </div>
        {wx && <p className="small">{wx}</p>}
        {wxText && <textarea readOnly value={wxText} rows={8} onFocus={(e) => e.currentTarget.select()} />}
      </Sec>

      {configured(cfg) && !cfg.viaGitHub && (
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
        <div className="actgrid">
          <button className="ibtn wide" onClick={() => { setTiles('Downloading…'); prefetchOverview(pts, true).then(refreshTiles); }}><Icon name="download" size={18} /> Download map</button>
        </div>
        <p className="small">{tiles}</p>
      </Sec>

      <Sec icon="download" title="Backup" hint="Browsers can delete stored data, and iOS does so for sites you have not used for a while. Export a file now and then, or turn on sync.">
        <div className="actgrid">
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
