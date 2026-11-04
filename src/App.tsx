import { useMemo } from 'react';
import { addDays, diffDays, fmtShortDate } from './dates';
import { schedule, totals } from './model';
import { go, useRoute, href } from './nav';
import { useStore } from './store';
import { MapView } from './views/MapView';
import { Place } from './views/Place';
import { PlanView } from './views/PlanView';
import { Settings } from './views/Settings';
import { Timeline } from './views/Timeline';

const syncDot = { off: '', idle: '○', syncing: '↻', ok: '●', error: '⚠' } as const;

export function App() {
  const { plan, sync, setMeta } = useStore();
  const route = useRoute();
  const sched = useMemo(() => schedule(plan), [plan]);
  const t = useMemo(() => totals(plan, sched), [plan, sched]);
  const tab = route.view === 'place' ? 'plan' : route.view;
  const total = diffDays(plan.start, plan.end);

  return (
    <div className={`app v-${route.view}`}>
      <header className="top">
        <div className="dates">
          <input type="date" aria-label="start date" value={plan.start} onChange={(e) => e.target.value && setMeta({ start: e.target.value })} />
          <span>→</span>
          <input type="date" aria-label="end date" value={plan.end} onChange={(e) => e.target.value && setMeta({ end: e.target.value })} />
        </div>
        <div className={`budget ${t.over > 0 ? 'over' : t.over < 0 ? 'under' : 'ok'}`} title={`${t.nights} nights planned`}>
          <b>{t.endDay}</b>/{total} nights
          <small>
            {t.over > 0 ? `${t.over} over` : t.over < 0 ? `${-t.over} free` : 'exact'} · ends {fmtShortDate(addDays(plan.start, t.endDay))}
          </small>
        </div>
        <a className={`sync s-${sync.status}`} href={href({ view: 'settings' })} title={sync.error ?? sync.status}>
          {syncDot[sync.status]} ⚙
        </a>
      </header>
      <main>
        {route.view === 'plan' && <PlanView />}
        {route.view === 'map' && <MapView />}
        {route.view === 'timeline' && <Timeline />}
        {route.view === 'place' && <Place id={route.id} />}
        {route.view === 'settings' && <Settings />}
      </main>
      <nav className="tabs">
        {(['plan', 'map', 'timeline'] as const).map((v) => (
          <button key={v} className={tab === v ? 'on' : ''} onClick={() => go({ view: v })}>
            <span>{v === 'plan' ? '☰' : v === 'map' ? '🗺️' : '📊'}</span>
            {v === 'plan' ? 'Plan' : v === 'map' ? 'Map' : 'Timeline'}
          </button>
        ))}
      </nav>
    </div>
  );
}
