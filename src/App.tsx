import { useMemo } from 'react';
import { addDays, diffDays, fmtShortDate } from './dates';
import { Icon } from './icons';
import { schedule, totals } from './model';
import { go, href, useRoute } from './nav';
import { useStore } from './store';
import { MapView } from './views/MapView';
import { Place } from './views/Place';
import { PlanView } from './views/PlanView';
import { Settings } from './views/Settings';
import { Timeline } from './views/Timeline';

const syncIcon = { off: null, idle: 'cloud', syncing: 'sync', ok: 'check', error: 'alert' } as const;
const tabIcon = { plan: 'list', map: 'map', timeline: 'timeline' } as const;

export function App() {
  const { plan, sync } = useStore();
  const route = useRoute();
  const sched = useMemo(() => schedule(plan), [plan]);
  const t = useMemo(() => totals(plan, sched), [plan, sched]);
  const tab = route.view === 'place' ? 'plan' : route.view;
  const total = diffDays(plan.start, plan.end);
  const si = syncIcon[sync.status];

  return (
    <>
      <header className="top">
        <div className={`budget ${t.over > 0 ? 'over' : t.over < 0 ? 'under' : 'ok'}`}>
          <b>{t.endDay}</b>/{total} nights
          <small>
            {fmtShortDate(plan.start)} → {fmtShortDate(addDays(plan.start, t.endDay))}
            {t.over > 0 ? ` · ${t.over} over` : t.over < 0 ? ` · ${-t.over} free` : ''}
          </small>
        </div>
        <span className="spacer" />
        <a className={`sync s-${sync.status} ${route.view === 'settings' ? 'on' : ''}`} href={href({ view: 'settings' })} title={sync.error ?? sync.status} aria-label="settings">
          {si && <Icon name={si} size={17} className={sync.status === 'syncing' ? 'spin' : ''} />}
          <Icon name="settings" size={22} />
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
            <Icon name={tabIcon[v]} size={22} />
            {v === 'plan' ? 'Plan' : v === 'map' ? 'Map' : 'Timeline'}
          </button>
        ))}
      </nav>
    </>
  );
}
