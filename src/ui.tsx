import { useEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { chosenOption, legOvernight } from './model';
import type { Leg } from './types';

export const modeIcon = (mode: string) => {
  const m = mode.toLowerCase();
  if (/(fly|flight|plane|air)/.test(m)) return '✈️';
  if (/(train|rail|metro)/.test(m)) return '🚆';
  if (/(boat|ferry|ship|cruise)/.test(m)) return '⛴️';
  if (/(bus|coach|minivan|van)/.test(m)) return '🚌';
  if (/(bike|scooter|moto)/.test(m)) return '🏍️';
  if (/(car|taxi|grab|drive|cab)/.test(m)) return '🚕';
  if (/(walk|hike|trek)/.test(m)) return '🥾';
  return '➡️';
};

export const legSummary = (l: Leg) => {
  const o = chosenOption(l);
  if (!o) return 'No transport yet';
  return `${modeIcon(o.mode)} ${o.mode || 'Transport'}${o.duration ? ` · ${o.duration}` : ''}${legOvernight(l) ? ' · 🌙 overnight' : ''}`;
};

export function Stepper({ value, onChange, min = 0, label }: { value: number; onChange: (n: number) => void; min?: number; label?: string }) {
  return (
    <div className="stepper" role="group" aria-label={label ?? 'nights'}>
      <button type="button" aria-label="fewer nights" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span><b>{value}</b> <small>{value === 1 ? 'night' : 'nights'}</small></span>
      <button type="button" aria-label="more nights" onClick={() => onChange(value + 1)}>+</button>
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
