import { Fragment, useMemo } from 'react';
import { addDays, fmtDate } from '../dates';
import { appendStop, branchesOf, chosenOption, legOvernight, outs, schedule, setActiveOut } from '../model';
import { go } from '../nav';
import { useStore } from '../store';
import { legSummary, Stepper } from '../ui';

export function PlanView() {
  const { plan, update } = useStore();
  const s = useMemo(() => schedule(plan), [plan]);
  const orphans = Object.values(plan.stops).filter((x) => !x.deleted && !s.onPath.has(x.id) && s.arrive[x.id] === undefined);

  return (
    <div className="page">
      {s.path.map((id, i) => {
        const st = plan.stops[id];
        const arrive = addDays(plan.start, s.arrive[id]);
        const depart = addDays(plan.start, s.arrive[id] + st.nights);
        const o = outs(plan, id);
        const aLeg = o.find((l) => s.activeLegs.has(l.id));
        const hotelNights = Math.max(0, st.nights - (aLeg && legOvernight(aLeg) ? 1 : 0));
        const isFork = o.length > 1;
        const branches = isFork ? branchesOf(plan, s, id) : [];
        const inCount = Object.values(plan.legs).filter((l) => !l.deleted && l.to === id).length;
        return (
          <Fragment key={id}>
            <section className="card stop">
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
                    {hotelNights !== st.nights && <span> · {hotelNights} hotel</span>}
                  </div>
                </div>
              </div>
              <div className="stop-foot">
                <Stepper value={st.nights} onChange={(n) => update((d) => { d.stops[id].nights = n; d.stops[id].updatedAt = Date.now(); })} />
                {st.notes && <span className="note-peek">{st.notes.split('\n')[0]}</span>}
              </div>
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
              <div className="legrow" onClick={() => go({ view: 'place', id })}>
                <span className="line" />
                <span className="pill">{legSummary(aLeg)}</span>
                {aLeg.options.length > 1 && <span className="pill alt">{aLeg.options.length} options</span>}
                {chosenOption(aLeg)?.cost && <span className="pill alt">{chosenOption(aLeg)!.cost}</span>}
              </div>
            )}
          </Fragment>
        );
      })}
      <button className="big" onClick={() => update((d) => { const last = s.path[s.path.length - 1]; const n = appendStop(d, last); setTimeout(() => go({ view: 'place', id: n }), 0); })}>
        ＋ Add stop
      </button>
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
