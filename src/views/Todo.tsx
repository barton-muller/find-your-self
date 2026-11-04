import { useMemo, useState } from 'react';
import { addDays, diffDays, fmtShortDate, todayStr } from '../dates';
import { Icon } from '../icons';
import { checklist, deleteTodo, schedule, sortCheck, toggleLegBooked, toggleStay, upsertTodo, type CheckItem } from '../model';
import { go } from '../nav';
import { useStore } from '../store';

export function Todo() {
  const { plan, update } = useStore();
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);
  const s = useMemo(() => schedule(plan), [plan]);
  const today = diffDays(plan.start, todayStr());
  const items = useMemo(() => checklist(plan, s, today).sort(sortCheck), [plan, s, today]);
  const open = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  const toggle = (i: CheckItem) =>
    update((p) => {
      if (i.kind === 'stay') toggleStay(p, i.stopId!);
      else if (i.kind === 'transport') toggleLegBooked(p, i.legId!);
      else upsertTodo(p, { id: i.todoId, done: !i.done });
    });

  const dueLabel = (n: number | null) => {
    if (n === null) return { t: 'no date', c: 'muted' };
    const d = n - today;
    const date = fmtShortDate(addDays(plan.start, n));
    if (d < 0) return { t: `${-d}d overdue · ${date}`, c: 'over' };
    if (d === 0) return { t: `today · ${date}`, c: 'soon' };
    if (d === 1) return { t: `tomorrow · ${date}`, c: 'soon' };
    return { t: `in ${d}d · ${date}`, c: d <= 7 ? 'soon' : 'muted' };
  };

  const row = (i: CheckItem) => {
    const l = dueLabel(i.due);
    const t = i.todoId ? plan.todos?.[i.todoId] : undefined;
    return (
      <div key={i.key} className={`card trow ${i.done ? 'done' : ''}`}>
        <button className={`tick ${i.done ? 'on' : ''}`} aria-label={i.done ? 'mark not done' : 'mark done'} onClick={() => toggle(i)}>
          {i.done && <Icon name="check" size={16} />}
        </button>
        <div className="grow" onClick={() => i.stopId && go({ view: 'place', id: i.stopId })}>
          {t ? (
            <input className="ttext" value={t.text} onClick={(e) => e.stopPropagation()} onChange={(e) => update((p) => upsertTodo(p, { id: t.id, text: e.target.value }))} />
          ) : (
            <b>{i.title}</b>
          )}
          <div className="sub">
            <span className={`due ${l.c}`}>{l.t}</span>
            {i.sub && ` · ${i.sub}`}
            {t && (
              <input type="date" className="dateinline" value={t.due ?? ''} aria-label="due date" onClick={(e) => e.stopPropagation()}
                onChange={(e) => update((p) => upsertTodo(p, { id: t.id, due: e.target.value || null }))} />
            )}
          </div>
        </div>
        {t && <button className="x" aria-label="delete" onClick={() => update((p) => deleteTodo(p, t.id))}><Icon name="x" size={14} /></button>}
      </div>
    );
  };

  return (
    <div className="page">
      <form className="card addtodo" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; update((p) => upsertTodo(p, { text: text.trim(), due: due || null })); setText(''); setDue(''); }}>
        <input value={text} placeholder="Add a to-do…" onChange={(e) => setText(e.target.value)} />
        <input type="date" value={due} aria-label="due date" onChange={(e) => setDue(e.target.value)} />
        <button className="primary" type="submit" disabled={!text.trim()}><Icon name="plus" size={16} /></button>
      </form>
      <h2>Soonest first</h2>
      {open.length === 0 && <p className="muted">All done.</p>}
      {open.map(row)}
      {done.length > 0 && (
        <>
          <button className="link" onClick={() => setShowDone(!showDone)}>{showDone ? 'Hide' : 'Show'} {done.length} done</button>
          {showDone && done.map(row)}
        </>
      )}
    </div>
  );
}
