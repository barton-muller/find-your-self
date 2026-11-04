import { useEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { chosenOption, legOvernight } from './model';
import { Icon, type IconName } from './icons';
import type { Leg } from './types';

export const modeIcon = (mode: string): IconName => {
  const m = mode.toLowerCase();
  if (/(fly|flight|plane|air)/.test(m)) return 'plane';
  if (/(train|rail|metro)/.test(m)) return 'train';
  if (/(boat|ferry|ship|cruise)/.test(m)) return 'boat';
  if (/(bus|coach|minivan|van)/.test(m)) return 'bus';
  if (/(bike|scooter|moto)/.test(m)) return 'bike';
  if (/(car|taxi|grab|drive|cab)/.test(m)) return 'car';
  if (/(walk|hike|trek)/.test(m)) return 'walk';
  return 'arrow';
};

export function LegSummary({ leg }: { leg: Leg }) {
  const o = chosenOption(leg);
  if (!o) return <span className="ls">No transport yet</span>;
  return (
    <span className="ls">
      <Icon name={modeIcon(o.mode)} size={15} /> {o.mode || 'Transport'}
      {o.duration && ` · ${o.duration}`}
      {legOvernight(leg) && <><Icon name="moon" size={14} className="moon" /> overnight</>}
    </span>
  );
}

export function Stepper({ value, onChange, min = 0, label }: { value: number; onChange: (n: number) => void; min?: number; label?: string }) {
  return (
    <div className="stepper" role="group" aria-label={label ?? 'nights'}>
      <button type="button" aria-label="fewer nights" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" size={18} /></button>
      <span><b>{value}</b> <small>{value === 1 ? 'night' : 'nights'}</small></span>
      <button type="button" aria-label="more nights" onClick={() => onChange(value + 1)}><Icon name="plus" size={18} /></button>
    </div>
  );
}

export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea rows={1} {...props} ref={ref} />;
}
