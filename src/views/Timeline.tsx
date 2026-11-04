import { useMemo } from 'react';
import { addDays, diffDays, fmtMonthName } from '../dates';
import { chosenOption, lanes, legOvernight, liveLegs, liveStops, schedule } from '../model';
import { go } from '../nav';
import { useStore } from '../store';
import { modeIcon } from '../ui';

const LANE_H = 78;
const TOP = 44;
const PAD = 16;

export function Timeline() {
  const { plan } = useStore();
  const PPD = Math.max(30, Math.floor((window.innerWidth - 40) / (Math.max(diffDays(plan.start, plan.end), 1) + 1)));
  const s = useMemo(() => schedule(plan), [plan]);
  const lane = useMemo(() => lanes(plan, s), [plan, s]);
  const days = Math.max(diffDays(plan.start, plan.end), 1);
  const stops = liveStops(plan).filter((x) => s.arrive[x.id] !== undefined);
  const maxArrive = Math.max(days, ...stops.map((x) => s.arrive[x.id] + x.nights));
  const nLanes = Math.max(1, ...stops.map((x) => lane[x.id] + 1));
  const W = PAD * 2 + (maxArrive + 1) * PPD;
  const H = TOP + nLanes * LANE_H + 10;
  const X = (d: number) => PAD + d * PPD;
  const Y = (l: number) => TOP + l * LANE_H + 44;

  const ticks = Array.from({ length: maxArrive + 1 }, (_, i) => i);
  const perLane: Record<number, string[]> = {};
  stops
    .slice()
    .sort((a, b) => s.arrive[a.id] - s.arrive[b.id])
    .forEach((x) => {
      const l = lane[x.id];
      (perLane[l] ??= []).push(x.id);
    });

  return (
    <div className="tl-scroll">
      <svg width={W} height={H} role="img" aria-label="Trip timeline">
        {ticks.map((i) => {
          const d = addDays(plan.start, i);
          const dayNum = Number(d.slice(8));
          const first = dayNum === 1 || i === 0;
          const weekly = i % 7 === 0;
          return (
            <g key={i}>
              <line x1={X(i)} x2={X(i)} y1={first ? 14 : TOP - 8} y2={H} className={first ? 'grid month' : weekly ? 'grid week' : 'grid'} />
              {first && <text x={X(i) + 3} y={12} className="mon">{fmtMonthName(d)}</text>}
              {(weekly || dayNum === 1) && <text x={X(i)} y={TOP - 12} textAnchor="middle" className="tick">{dayNum}</text>}
            </g>
          );
        })}
        <line x1={X(days)} x2={X(days)} y1={14} y2={H} className="endline" />
        <text x={X(days) - 4} y={H - 4} textAnchor="end" className="tick">end</text>

        {liveLegs(plan).map((l) => {
          if (s.arrive[l.from] === undefined || s.arrive[l.to] === undefined) return null;
          const fa = plan.stops[l.from];
          const x1 = X(s.arrive[l.from] + fa.nights);
          const x2 = X(s.arrive[l.to]);
          const y1 = Y(lane[l.from]);
          const y2 = Y(lane[l.to]);
          const mx = (x1 + x2) / 2;
          const active = s.activeLegs.has(l.id);
          const o = chosenOption(l);
          return (
            <g key={l.id} className={active ? 'edge on' : 'edge'}>
              <path d={`M${x1},${y1} C${mx + 12},${y1} ${mx - 12},${y2} ${x2},${y2}`} fill="none" />
              {active && o && (
                <text x={mx} y={(y1 + y2) / 2 - 6} textAnchor="middle" className="ico">
                  {modeIcon(o.mode)}{legOvernight(l) ? '🌙' : ''}
                </text>
              )}
            </g>
          );
        })}

        {stops.map((x) => {
          const l = lane[x.id];
          const on = s.onPath.has(x.id);
          const idx = perLane[l].indexOf(x.id);
          const w = Math.max(x.nights * PPD, 10);
          return (
            <g key={x.id} className={`node ${on ? 'on' : 'alt'}`} onClick={() => go({ view: 'place', id: x.id })} style={{ cursor: 'pointer' }}>
              <rect x={X(s.arrive[x.id])} y={Y(l) - 9} width={w} height={18} rx={9} />
              <text x={X(s.arrive[x.id]) + 2} y={Y(l) - 14 - (idx % 2) * 14} className="lbl">
                {x.name || '…'} <tspan className="n">{x.nights}n</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
