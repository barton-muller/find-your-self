import { useEffect, useMemo } from 'react';
import { addDays, diffDays, fmtShortDate, todayStr } from './dates';
import { Icon } from './icons';
import { checklist, schedule, totals } from './model';
import { go, href, useRoute } from './nav';
import { useStore } from './store';
import { MapView } from './views/MapView';
import { Place } from './views/Place';
import { PlanView } from './views/PlanView';
import { Settings } from './views/Settings';
import { Timeline } from './views/Timeline';
import { Todo } from './views/Todo';

const syncIcon = { off: null, idle: 'cloud', syncing: 'sync', ok: 'check', error: 'alert' } as const;
const tabIcon = { plan: 'list', map: 'map', timeline: 'timeline', todo: 'todo' } as const;
const tabName = { plan: 'Plan', map: 'Map', timeline: 'Timeline', todo: 'To-do' } as const;

export function App() {
  const { plan, sync, undo, redo, canUndo, canRedo } = useStore();
  const route = useRoute();
  const sched = useMemo(() => schedule(plan), [plan]);
  const t = useMemo(() => totals(plan, sched), [plan, sched]);
  const tab = route.view === 'place' ? 'plan' : route.view;
  const total = diffDays(plan.start, plan.end);
  const si = syncIcon[sync.status];
  const urgent = useMemo(() => {
    const today = diffDays(plan.start, todayStr());
    return checklist(plan, sched, today).filter((i) => !i.done && i.due !== null && i.due - today <= 7).length;
  }, [plan, sched]);
  useEffect(() => {
    document.documentElement.classList.toggle('lock', route.view === 'map');
    return () => document.documentElement.classList.remove('lock');
  }, [route.view]);

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
        <button className="hb" aria-label="undo" disabled={!canUndo} onClick={undo}><Icon name="undo" size={20} /></button>
        <button className="hb" aria-label="redo" disabled={!canRedo} onClick={redo}><Icon name="redo" size={20} /></button>
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
        {route.view === 'todo' && <Todo />}
        {route.view === 'settings' && <Settings />}
      </main>
      <nav className="tabs">
        {(['map', 'timeline', 'plan', 'todo'] as const).map((v) => (
          <button key={v} className={tab === v ? 'on' : ''} onClick={() => go({ view: v })}>
            <Icon name={tabIcon[v]} size={22} />
            {tabName[v]}
            {v === 'todo' && urgent > 0 && <span className="badge">{urgent}</span>}
          </button>
        ))}
      </nav>
    </>
  );
}
