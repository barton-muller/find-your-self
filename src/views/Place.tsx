import { useMemo, useState } from 'react';
import { addDays, fmtDate } from '../dates';
import {
  addBranch, appendStop, colorIndex, deleteLeg, deleteStop, insertOnLeg, ins, legOvernight, liveStops, linkStops, newOption, outs,
  hotelNights, reachable, schedule, setActiveOut, touchLeg, touchStop,
} from '../model';
import { findCity } from '../cities';
import { CitySearch } from './CitySearch';
import { go } from '../nav';
import { useStore } from '../store';
import { Icon } from '../icons';
import { AutoTextarea, LegSummary, modeIcon, Stepper } from '../ui';
import type { Leg } from '../types';

const MODES = ['Flight', 'Train', 'Bus', 'Minivan', 'Sleeper bus', 'Sleeper train', 'Boat', 'Ferry', 'Slow boat', 'Taxi', 'Motorbike', 'Car'];

const coordText = (lat: number | null, lng: number | null) => (lat === null || lng === null ? '' : `${lat}, ${lng}`);
const parseCoords = (t: string): [number, number] | null => {
  const m = t.match(/(-?\d+(?:\.\d+)?)[\s,;]+(-?\d+(?:\.\d+)?)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
};

export function Place({ id }: { id: string }) {
  const { plan, update } = useStore();
  const st = plan.stops[id];
  const s = useMemo(() => schedule(plan), [plan]);
  const ci = useMemo(() => colorIndex(plan, s), [plan, s]);
  const [coordDraft, setCoordDraft] = useState<{ id: string; v: string } | null>(null);
  const [linkTo, setLinkTo] = useState('');

  if (!st || st.deleted) {
    return (
      <div className="page">
        <p>Stop not found.</p>
        <button className="big" onClick={() => go({ view: 'plan' })}>Back to plan</button>
      </div>
    );
  }

  const prev = ins(plan, id);
  const next = outs(plan, id);
  const arr = s.arrive[id];
  const arrive = arr === undefined ? null : addDays(plan.start, arr);
  const edit = (fn: (x: typeof st) => void) =>
    update((d) => {
      fn(d.stops[id]);
      touchStop(d, id);
    });
  const ownCoord = coordDraft?.id === id ? coordDraft.v : coordText(st.lat, st.lng);
  const linkable = liveStops(plan).filter(
    (x) => x.id !== id && !next.some((l) => l.to === x.id) && !reachable(plan, x.id).has(id),
  );

  return (
    <div className="page place">
      <div className="arrows">
        <div className="col left">
          {prev.length === 0 && <span className="muted">start</span>}
          {prev.map((l) => (
            <button key={l.id} className="arrow" onClick={() => go({ view: 'place', id: l.from })}>
              ← {plan.stops[l.from].name}
            </button>
          ))}
        </div>
        <div className="col right">
          {next.length === 0 && <span className="muted">end</span>}
          {next.map((l) => (
            <button key={l.id} className={`arrow ${s.activeLegs.has(l.id) ? 'on' : 'alt'}`} onClick={() => go({ view: 'place', id: l.to })}>
              {plan.stops[l.to].name} →
            </button>
          ))}
        </div>
      </div>

      <section className="card cbar" style={{ '--cc': `var(--c${ci[id] ?? 0})` } as React.CSSProperties}>
        <CitySearch
          value={st.name}
          onType={(v) => {
            const c = findCity(v);
            edit((x) => {
              x.name = v;
              if (c && x.lat === null) {
                x.lat = c[1];
                x.lng = c[2];
              }
            });
          }}
          onPick={(h) => edit((x) => { x.name = h.name; x.lat = h.lat; x.lng = h.lng; })}
        />
        <div className="sub">
          {arrive ? `${fmtDate(arrive)} → ${fmtDate(addDays(plan.start, arr + st.nights))}` : 'Not on a scheduled path'}
          {!s.onPath.has(id) && arrive && <span className="chip alt">alternative</span>}
        </div>
        <div className="rowflex">
          <Stepper value={st.nights} onChange={(n) => edit((x) => { x.nights = n; })} />
          {st.lat === null && <span className="nopin">No map location. Pick a suggestion above.</span>}
        </div>
        <details className="coordbox">
          <summary>Coordinates</summary>
          <input
            inputMode="decimal"
            value={ownCoord}
            placeholder="lat, lng (paste from maps)"
            onChange={(e) => {
              const v = e.target.value;
              setCoordDraft({ id, v });
              const c = parseCoords(v);
              if (c) edit((x) => { x.lat = c[0]; x.lng = c[1]; });
              else if (v.trim() === '') edit((x) => { x.lat = null; x.lng = null; });
            }}
            onBlur={() => setCoordDraft(null)}
          />
        </details>
        <AutoTextarea value={st.notes} placeholder="Notes: accommodation, ideas, bookings…" onChange={(e) => edit((x) => { x.notes = e.target.value; })} />
      </section>

      {hotelNights(plan, s, id) > 0 && (
        <section className="card">
          <div className="label">Accommodation</div>
          <div className="rowflex" style={{ marginTop: 0 }}>
            <input className="grow" value={st.accom ?? ''} placeholder="Hotel, ref, cost…" onChange={(e) => edit((x) => { x.accom = e.target.value; })} />
            <button className={`bk big-bk ${st.accomBooked ? 'on' : ''}`} onClick={() => edit((x) => { x.accomBooked = !x.accomBooked; })}>
              <Icon name="check" size={14} /> {st.accomBooked ? 'Booked' : 'Not booked'}
            </button>
          </div>
        </section>
      )}

      <h2>Days</h2>
      {Array.from({ length: st.nights + 1 }, (_, i) => {
        const d = arrive ? addDays(arrive, i) : null;
        const lbl = i === 0 ? 'Arrive' : i === st.nights ? 'Depart' : `Day ${i + 1}`;
        const outLeg = next.find((l) => s.activeLegs.has(l.id)) ?? next[0];
        return (
          <div key={i} className="card day">
            <div className="label">
              {lbl}{d && ` · ${fmtDate(d)}`}
              {i === st.nights && outLeg && legOvernight(outLeg) && <> · <Icon name="moon" size={13} className="moon" /> overnight travel</>}
            </div>
            <AutoTextarea
              value={st.days[i] ?? ''}
              placeholder="Activities, one per line"
              onChange={(e) => edit((x) => { const a = [...x.days]; while (a.length <= i) a.push(''); a[i] = e.target.value; x.days = a; })}
            />
          </div>
        );
      })}

      <h2>Getting here</h2>
      {prev.length === 0 && <p className="muted">Trip start.</p>}
      {prev.map((l) => (
        <div key={l.id} className="card row" onClick={() => go({ view: 'place', id: l.from })}>
          <span>From <b>{plan.stops[l.from].name}</b></span>
          <span className="pill"><LegSummary leg={l} /></span>
        </div>
      ))}

      <h2>Onward</h2>
      {next.length === 0 && <p className="muted">No next stop yet.</p>}
      {next.map((l) => (
        <LegEditor key={l.id} leg={l} fork={next.length > 1} active={s.activeLegs.has(l.id)} />
      ))}

      <div className="actions">
        <button onClick={() => update((d) => { const n = appendStop(d, id); setTimeout(() => go({ view: 'place', id: n }), 0); })}>
          <Icon name="plus" size={16} /> {next.length === 1 ? 'Insert stop after' : next.length === 0 ? 'Next stop' : 'Stop on active route'}
        </button>
        <button onClick={() => update((d) => { const n = addBranch(d, id); setTimeout(() => go({ view: 'place', id: n }), 0); })}><Icon name="fork" size={16} /> Add branch</button>
        {linkable.length > 0 && (
          <div className="linkrow">
            <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)}>
              <option value="">Link to existing stop…</option>
              {linkable.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button disabled={!linkTo} onClick={() => { update((d) => linkStops(d, id, linkTo)); setLinkTo(''); }}>Link</button>
          </div>
        )}
        {id !== plan.startId && (
          <button className="danger" onClick={() => {
            if (!confirm(`Delete ${st.name}?`)) return;
            update((d) => deleteStop(d, id));
            go({ view: 'plan' });
          }}>Delete stop</button>
        )}
      </div>
    </div>
  );
}

function LegEditor({ leg, fork, active }: { leg: Leg; fork: boolean; active: boolean }) {
  const { plan, update } = useStore();
  const to = plan.stops[leg.to];
  const edit = (fn: (l: Leg) => void) =>
    update((d) => {
      fn(d.legs[leg.id]);
      touchLeg(d, leg.id);
    });

  return (
    <div className={`card leg ${active ? '' : 'inactive'}`}>
      <div className="leghead">
        <b>→ {to.name}</b>
        {fork && (
          active ? <span className="chip fork">active route</span> : (
            <button className="link" onClick={() => update((d) => setActiveOut(d, leg.from, leg.id))}>make active</button>
          )
        )}
        <span className="grow" />
        <button className="link danger-t" onClick={() => confirm('Remove this connection?') && update((d) => deleteLeg(d, leg.id))}>remove</button>
      </div>
      {leg.options.map((o) => {
        const upd = (fn: (x: typeof o) => void) => edit((l) => fn(l.options.find((x) => x.id === o.id)!));
        return (
          <div key={o.id} className={`opt ${leg.chosen === o.id ? 'chosen' : ''}`}>
            <div className="opthead">
              <label className="radio">
                <input type="radio" name={`c-${leg.id}`} checked={leg.chosen === o.id} onChange={() => edit((l) => { l.chosen = o.id; })} />
                <span>{leg.chosen === o.id ? 'Chosen' : 'Use'}</span>
              </label>
              <Icon name={modeIcon(o.mode)} size={22} className="ico" />
              <input list="modes" className="mode" value={o.mode} placeholder="Mode" onChange={(e) => upd((x) => { x.mode = e.target.value; })} />
              <button className="x" aria-label="remove option" onClick={() => edit((l) => {
                l.options = l.options.filter((x) => x.id !== o.id);
                if (l.chosen === o.id) l.chosen = l.options[0]?.id ?? null;
              })}><Icon name="x" size={14} /></button>
            </div>
            <div className="grid2">
              <input value={o.duration} placeholder="Duration (e.g. 10h)" onChange={(e) => upd((x) => { x.duration = e.target.value; })} />
              <input value={o.cost} placeholder="Cost" onChange={(e) => upd((x) => { x.cost = e.target.value; })} />
            </div>
            <input value={o.notes} placeholder="Notes: operator, times, booking…" onChange={(e) => upd((x) => { x.notes = e.target.value; })} />
            <div className="rowflex">
              <button className={`bk big-bk ${o.booked ? 'on' : ''}`} onClick={() => upd((x) => { x.booked = !x.booked; })}>
                <Icon name="check" size={14} /> {o.booked ? 'Booked' : 'Not booked'}
              </button>
              <label className="check"><input type="checkbox" checked={o.overnight} onChange={(e) => upd((x) => { x.overnight = e.target.checked; })} /> <Icon name="moon" size={15} className="moon" /> Overnight</label>
              <label className="check">
                +days
                <input type="number" min={0} className="num" value={o.extraDays} onChange={(e) => upd((x) => { x.extraDays = Math.max(0, parseInt(e.target.value || '0', 10)); })} />
              </label>
            </div>
          </div>
        );
      })}
      <button className="link" onClick={() => update((d) => { const n = insertOnLeg(d, leg.id); setTimeout(() => go({ view: 'place', id: n }), 0); })}>
        <Icon name="plus" size={14} /> Insert stop on this connection
      </button>
      <button className="link" onClick={() => edit((l) => { const o = newOption(''); l.options.push(o); if (!l.chosen) l.chosen = o.id; })}><Icon name="plus" size={14} /> Add option</button>
      <datalist id="modes">{MODES.map((m) => <option key={m} value={m} />)}</datalist>
    </div>
  );
}
