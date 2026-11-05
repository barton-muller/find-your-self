import { useEffect, useMemo, useRef } from 'react';
import { addDays, diffDays, fmtMonthName, todayStr } from '../dates';
import { activeOutLeg, chosenOption, colorIndex, lanes, legOvernight, liveLegs, liveStops, schedule } from '../model';
import { iconPath } from '../icons';
import { go } from '../nav';
import { useStore } from '../store';
import { modeIcon } from '../ui';

const PPD = 34;
const PP = 14;
const AXIS = 60;
const TOP = 12;
const BAR = 16;

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'narrow', timeZone: 'UTC' });

export function Timeline() {
  const { plan } = useStore();
  const s = useMemo(() => schedule(plan), [plan]);
  const lane = useMemo(() => lanes(plan, s), [plan, s]);
  const ci = useMemo(() => colorIndex(plan, s), [plan, s]);
  const days = Math.max(diffDays(plan.start, plan.end), 1);
  const today = diffDays(plan.start, todayStr());
  const todayRef = useRef<SVGRectElement>(null);
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'center' });
  }, []);
  const stops = liveStops(plan).filter((x) => s.arrive[x.id] !== undefined);
  const maxDay = Math.max(days, ...stops.map((x) => s.arrive[x.id] + x.nights));
  const nLanes = Math.max(1, ...stops.map((x) => lane[x.id] + 1));
  const laneW = Math.max(150, Math.min(210, Math.floor((window.innerWidth - AXIS - 20) / nLanes)));
  const W = AXIS + nLanes * laneW + 24;
  const t = Math.min(Math.max(today, 0), maxDay + 1);
  const Y = (d: number) => TOP + (d <= t ? d * PP : t * PP + (d - t) * PPD);
  const H = Y(maxDay + 1) + 20;
  const X = (l: number) => AXIS + 14 + l * laneW;

  return (
    <div className="tl-scroll">
      <svg width={W} height={H} role="img" aria-label="Trip timeline">
        {Array.from({ length: maxDay + 1 }, (_, i) => {
          const d = addDays(plan.start, i);
          const dayNum = Number(d.slice(8));
          const first = dayNum === 1 || i === 0;
          const weekStart = new Date(d + 'T00:00:00Z').getUTCDay() === 1;
          const past = i < t;
          const h = past ? PP : PPD;
          return (
            <g key={i} className={past ? 'pastday' : ''}>
              <line x1={AXIS - 4} x2={W} y1={Y(i)} y2={Y(i)} className={first ? 'grid month' : weekStart ? 'grid week' : 'grid'} />
              {(!past || weekStart || first) && (
                <text x={AXIS - 8} y={past ? Y(i) + h - 3 : Y(i) + PPD - 9} textAnchor="end" className="tick">
                  {dayNum} {!past && <tspan className="wd">{WEEKDAY.format(new Date(d + 'T00:00:00Z'))}</tspan>}
                </text>
              )}
              {first && !past && <text x={AXIS - 8} y={Y(i) + 12} textAnchor="end" className="mon">{fmtMonthName(d)}</text>}
            </g>
          );
        })}
        {today >= 0 && today <= days && (
          <g>
            <rect ref={todayRef} x={AXIS - 4} y={Y(today)} width={W} height={PPD} className="todaybg" />
            <text x={AXIS - 8} y={Y(today) + 12} textAnchor="end" className="todaylbl">today</text>
          </g>
        )}
        <line x1={AXIS - 4} x2={W} y1={Y(days)} y2={Y(days)} className="endline" />
        <text x={W - 6} y={Y(days) - 4} textAnchor="end" className="tick">trip end</text>

        {liveLegs(plan).map((l) => {
          if (s.arrive[l.from] === undefined || s.arrive[l.to] === undefined) return null;
          const fa = plan.stops[l.from];
          const x1 = X(lane[l.from]) + BAR / 2;
          const x2 = X(lane[l.to]) + BAR / 2;
          const ov = legOvernight(l) && fa.nights > 0;
          const y1 = Y(s.arrive[l.from] + fa.nights - (ov ? 1 : 0));
          const y2 = Y(s.arrive[l.to]);
          const my = (y1 + y2) / 2;
          const active = s.activeLegs.has(l.id);
          const o = chosenOption(l);
          const right = ov && fa.nights >= 2;
          const ix = right ? Math.max(x1, x2) + BAR / 2 + 16 : Math.min(x1, x2) - BAR / 2 - 11;
          const iy = ov ? my : Math.max(my, y1 + 8);
          return (
            <g key={l.id} className={active ? 'edge on' : 'edge'}>
              <path stroke={`var(--c${ci[l.from]})`} d={`M${x1},${y1} C${x1},${my + 10} ${x2},${my - 10} ${x2},${y2}`} fill="none" />
              {active && o && (
                <g transform={`translate(${ix - 8},${iy - 8}) scale(0.67)`} className="eic">
                  <path d={iconPath(modeIcon(o.mode))} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                  {ov && <path transform={right ? 'translate(22,0)' : 'translate(0,20)'} d={iconPath('moon')} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />}
                </g>
              )}
            </g>
          );
        })}

        {stops.map((x) => {
          const l = lane[x.id];
          const on = s.onPath.has(x.id);
          const al = activeOutLeg(plan, x.id);
          const hotel = x.nights - (al && legOvernight(al) && x.nights > 0 ? 1 : 0);
          const h = Math.max(Y(s.arrive[x.id] + hotel) - Y(s.arrive[x.id]), 6);
          const past = s.arrive[x.id] + x.nights < today;
          return (
            <g key={x.id} className={`node ${on ? 'on' : 'alt'}${past ? ' past' : ''}`} onClick={() => go({ view: 'place', id: x.id })} style={{ cursor: 'pointer' }}>
              <rect x={X(l)} y={Y(s.arrive[x.id])} width={BAR} height={h} rx={BAR / 2} fill={`var(--c${ci[x.id]})`} />
              {past ? (
                <text x={X(l) + BAR + 8} y={Y(s.arrive[x.id]) + 11} className="n">{x.name || '…'} · {x.nights}n</text>
              ) : (
                <>
                  <text x={X(l) + BAR + 8} y={Y(s.arrive[x.id]) + 14} className="lbl">{x.name || '…'}</text>
                  <text x={X(l) + BAR + 8} y={Y(s.arrive[x.id]) + 28} className="n">{x.nights} {x.nights === 1 ? 'night' : 'nights'}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
