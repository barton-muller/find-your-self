import { diffDays, fmtDate, todayStr } from '../dates';
import { Icon } from '../icons';
import { activeOutLeg, chosenOption, hotelNights, schedule, toggleLegBooked, toggleStay } from '../model';
import { go } from '../nav';
import { useStore } from '../store';
import { LegSummary } from '../ui';

export function Today({ s }: { s: ReturnType<typeof schedule> }) {
  const { plan, update } = useStore();
  const total = diffDays(plan.start, plan.end);
  const d = diffDays(plan.start, todayStr());
  if (d < 0) return <section className="card today"><div className="label">Trip</div>Starts in <b>{-d}</b> {-d === 1 ? 'day' : 'days'} · {fmtDate(plan.start)}</section>;
  if (d > total + 1) return null;

  const id = s.path.find((x) => s.arrive[x] <= d && d <= s.arrive[x] + plan.stops[x].nights);
  if (!id) return null;
  const st = plan.stops[id];
  const i = d - s.arrive[id];
  const leaving = i === st.nights;
  const leg = activeOutLeg(plan, id);
  const acts = (st.days[i] ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
  const o = leg ? chosenOption(leg) : null;
  const hn = hotelNights(plan, s, id);

  return (
    <section className="card today">
      <div className="label">Today · {fmtDate(todayStr())} · day {d + 1} of {total + 1}</div>
      <div className="stop-head" onClick={() => go({ view: 'place', id })}>
        <h3>{st.name}</h3>
        <span className="sub">{i === 0 ? 'arriving' : leaving ? 'departing' : `night ${i} of ${st.nights}`}</span>
      </div>
      {acts.length > 0 ? (
        <ul>{acts.map((a, k) => <li key={k}>{a}</li>)}</ul>
      ) : (
        <p className="muted">No activities planned for today.</p>
      )}
      {leg && (
        <div className="today-next">
          <span className="muted">{leaving ? 'Heading to' : `Next in ${st.nights - i}d:`}</span>
          <b>{plan.stops[leg.to].name}</b>
          <span className="pill"><LegSummary leg={leg} /></span>
        </div>
      )}
      <div className="chips">
        {o && leg && (
          <button className={`bk ${o.booked ? 'on' : ''}`} onClick={() => update((p) => toggleLegBooked(p, leg.id))}>
            <Icon name="check" size={12} /> transport {o.booked ? 'booked' : 'not booked'}
          </button>
        )}
        {hn > 0 && (
          <button className={`bk ${st.accomBooked ? 'on' : ''}`} onClick={() => update((p) => toggleStay(p, id))}>
            <Icon name="bed" size={12} /> stay {st.accomBooked ? 'booked' : 'not booked'}
          </button>
        )}
      </div>
    </section>
  );
}
