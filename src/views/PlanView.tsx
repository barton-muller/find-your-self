import { Fragment, useEffect, useMemo, useState } from 'react';
import { addDays, diffDays, fmtDate, todayStr } from '../dates';
import { Icon } from '../icons';
import {
  appendStop, branchesOf, canSwapNext, chosenOption, colorIndex, hotelNights, insertOnLeg, outs, schedule, setActiveOut, swapWithNext,
  toggleLegBooked, toggleStay,
} from '../model';
import { go } from '../nav';
import { useStore } from '../store';
import { LegSummary, Stepper } from '../ui';
import { Today } from './Today';

const col = (i: number) => ({ '--cc': `var(--c${i})` }) as React.CSSProperties;

export function PlanView() {
  const { plan, update } = useStore();
  const [reorder, setReorder] = useState(false);
  const s = useMemo(() => schedule(plan), [plan]);
  const ci = useMemo(() => colorIndex(plan, s), [plan, s]);
  const orphans = Object.values(plan.stops).filter((x) => !x.deleted && !s.onPath.has(x.id) && s.arrive[x.id] === undefined);
  const nowId = useMemo(() => {
    const d = diffDays(plan.start, todayStr());
    return s.path.find((x) => s.arrive[x] <= d && d <= s.arrive[x] + plan.stops[x].nights);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.start, s]);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = sessionStorage.getItem('plan-scroll'); } catch { /* ignore */ }
    const raf = requestAnimationFrame(() => {
      if (saved !== null) window.scrollTo(0, Number(saved));
      else if (nowId) document.getElementById(`stop-${nowId}`)?.scrollIntoView({ block: 'start' });
    });
    const onScroll = () => { try { sessionStorage.setItem('plan-scroll', String(window.scrollY)); } catch { /* ignore */ } };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const openNew = (n: string) => setTimeout(() => go({ view: 'place', id: n }), 0);

  return (
    <div className="page">
      {!reorder && <Today s={s} />}
      <div className="toolbar">
        <button className={reorder ? 'on' : ''} onClick={() => setReorder(!reorder)}>
          <Icon name="reorder" size={16} /> {reorder ? 'Done' : 'Reorder'}
        </button>
      </div>
      {reorder && (
        <p className="muted">
          Move stops with the arrows. Each connection keeps its position in the route, so check transport after reordering. Stops at forks and merges can't move.
        </p>
      )}
      {s.path.map((id, i) => {
        const st = plan.stops[id];
        const arrive = addDays(plan.start, s.arrive[id]);
        const depart = addDays(plan.start, s.arrive[id] + st.nights);
        const o = outs(plan, id);
        const aLeg = o.find((l) => s.activeLegs.has(l.id));
        const hn = hotelNights(plan, s, id);
        const isFork = o.length > 1;
        const branches = isFork ? branchesOf(plan, s, id) : [];
        const inCount = Object.values(plan.legs).filter((l) => !l.deleted && l.to === id).length;

        if (reorder) {
          const canUp = i > 0 && canSwapNext(plan, s.path[i - 1]);
          const canDown = canSwapNext(plan, id);
          return (
            <div key={id} className="card rrow cbar" style={col(ci[id])}>
              <span className="idx">{i + 1}</span>
              <div className="grow">
                <b>{st.name || 'Unnamed'}</b>
                <small>{st.nights} nights · {fmtDate(arrive)}</small>
              </div>
              <button className="mv" aria-label="move up" disabled={!canUp} onClick={() => update((d) => swapWithNext(d, s.path[i - 1]))}><Icon name="up" size={22} /></button>
              <button className="mv" aria-label="move down" disabled={!canDown} onClick={() => update((d) => swapWithNext(d, id))}><Icon name="down" size={22} /></button>
            </div>
          );
        }

        return (
          <Fragment key={id}>
            <section id={`stop-${id}`} className="card stop cbar" style={col(ci[id])}>
              <div className="stop-head" onClick={() => go({ view: 'place', id })}>
                <span className="idx">{i + 1}</span>
                <div className="grow">
                  <h3>
                    {st.name || 'Unnamed'}
                    {isFork && <span className="chip fork">fork</span>}
                    {inCount > 1 && <span className="chip merge">merge</span>}
                  </h3>
                  <div className="sub">
                    {fmtDate(arrive)} → {fmtDate(depart)}
                    {hn !== st.nights && <span> · {hn} hotel</span>}
                  </div>
                </div>
              </div>
              <div className="stop-foot">
                <Stepper value={st.nights} onChange={(n) => update((d) => { d.stops[id].nights = n; d.stops[id].updatedAt = Date.now(); })} />
                <span className="grow" />
                {hn > 0 && (
                  <button className={`bk ${st.accomBooked ? 'on' : ''}`} onClick={() => update((d) => toggleStay(d, id))}>
                    <Icon name="bed" size={13} /> {st.accomBooked ? 'booked' : 'to book'}
                  </button>
                )}
              </div>
              {st.notes && <div className="note-peek">{st.notes.split('\n')[0]}</div>}
              {isFork && (
                <div className="forkbox">
                  <div className="label">Route options after {st.name}</div>
                  {branches.map((b) => (
                    <label key={b.leg.id} className={`branch ${b.active ? 'on' : ''}`}>
                      <input type="radio" name={`f-${id}`} checked={b.active} onChange={() => update((d) => setActiveOut(d, id, b.leg.id))} />
                      <span className="grow">
                        <b>{b.stops.length ? b.stops.map((x) => plan.stops[x].name).join(' → ') : plan.stops[b.leg.to].name}</b>
                        <small>
                          {b.stops.length > 0 && `${b.nights} nights`}
                          {b.merge && ` · rejoins at ${plan.stops[b.merge].name}`}
                          {b.delta !== null && !b.active && ` · ${b.delta === 0 ? 'same date' : b.delta > 0 ? `+${b.delta}d later` : `${-b.delta}d earlier`}`}
                        </small>
                      </span>
                      {!b.active && (
                        <button type="button" className="link" onClick={(e) => { e.preventDefault(); go({ view: 'place', id: b.stops[0] ?? b.leg.to }); }}>open</button>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </section>
            {aLeg && (
              <div className="legrow" style={col(ci[id])}>
                <span className="line" />
                <span className="go" onClick={() => go({ view: 'place', id })}>
                  <span className="pill"><LegSummary leg={aLeg} /></span>
                  {aLeg.options.length > 1 && <span className="pill alt">{aLeg.options.length} options</span>}
                  {chosenOption(aLeg) && (
                    <button className={`bk ${chosenOption(aLeg)!.booked ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); update((d) => toggleLegBooked(d, aLeg.id)); }}>
                      <Icon name="check" size={12} /> {chosenOption(aLeg)!.booked ? 'booked' : 'to book'}
                    </button>
                  )}
                </span>
                <button className="ins" aria-label="insert stop between" title="Insert stop between" onClick={() => update((d) => openNew(insertOnLeg(d, aLeg.id)))}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
            )}
          </Fragment>
        );
      })}
      {!reorder && (
        <button className="big" onClick={() => update((d) => openNew(appendStop(d, s.path[s.path.length - 1])))}>
          <Icon name="plus" size={16} /> Add stop
        </button>
      )}
      {orphans.length > 0 && (
        <section className="card">
          <div className="label">Unlinked stops</div>
          {orphans.map((x) => (
            <div key={x.id} className="row" onClick={() => go({ view: 'place', id: x.id })}>{x.name}</div>
          ))}
        </section>
      )}
    </div>
  );
}
