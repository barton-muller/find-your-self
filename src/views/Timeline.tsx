import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { countryOf } from '../cities';
import { addDays, diffDays, fmtMonthName, fmtShortDate, todayStr } from '../dates';
import { Icon, iconPath } from '../icons';
import {
  activeOutLeg, chosenOption, colorIndex, ins, lanes, legOvernight, liveLegs, liveStops, schedule,
} from '../model';
import { go } from '../nav';
import { useStore } from '../store';
import { modeIcon } from '../ui';

const HH = 46;
const TH = 54;
const AXIS = 30;
const TOP = 26;
const MAX_PPD = 60;

type ColorMode = 'auto' | 'country' | 'stop';
const NEXT_MODE: Record<ColorMode, ColorMode> = { auto: 'country', country: 'stop', stop: 'auto' };
const MODE_LABEL: Record<ColorMode, string> = { auto: 'Auto colour', country: 'By country', stop: 'By stop' };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const trunc = (t: string, px: number, cw: number) => {
  const max = Math.max(3, Math.floor(px / cw));
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const load = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : (JSON.parse(v) as T);
  } catch {
    return d;
  }
};
const save = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
};

function connector(x1: number, y1: number, x2: number, y2: number, branchOut: boolean): string {
  if (x1 === x2) return `M${x1},${y1} L${x2},${y2}`;
  const dy = Math.max(y2 - y1, 2);
  const R = Math.max(1, Math.min(6, dy / 2, Math.abs(x2 - x1) / 2));
  const sg = Math.sign(x2 - x1);
  const yb = branchOut ? y1 : y1 + dy - 2 * R;
  const s1 = sg > 0 ? 0 : 1;
  const s2 = sg > 0 ? 1 : 0;
  return `M${x1},${y1} L${x1},${yb} A${R},${R} 0 0 ${s1} ${x1 + sg * R},${yb + R} L${x2 - sg * R},${yb + R} A${R},${R} 0 0 ${s2} ${x2},${yb + 2 * R} L${x2},${y2}`;
}

export function Timeline() {
  const { plan } = useStore();
  const s = useMemo(() => schedule(plan), [plan]);
  const lane = useMemo(() => lanes(plan, s), [plan, s]);
  const ci = useMemo(() => colorIndex(plan, s), [plan, s]);
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(() => Math.min(window.innerWidth, 820));
  const [ppdState, setPpd] = useState<number>(() => load('tl-ppd2', 26));
  const [mode, setMode] = useState<ColorMode>(() => load<ColorMode>('tl-mode', 'auto'));
  const anchor = useRef<{ day: number; screenY: number } | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; ppd: number } | null>(null);

  const days = Math.max(diffDays(plan.start, plan.end), 1);
  const today = diffDays(plan.start, todayStr());
  const stops = useMemo(() => liveStops(plan).filter((x) => s.arrive[x.id] !== undefined), [plan, s]);
  const maxDay = Math.max(days, ...stops.map((x) => s.arrive[x.id] + x.nights));

  const fitPpd = clamp((window.innerHeight - HH - TH - TOP - 50) / (maxDay + 1), 5, 30);
  const ppd = clamp(ppdState, fitPpd, MAX_PPD);
  const Y = (d: number) => TOP + d * ppd;
  const H = Y(maxDay + 1) + 40;

  const LW = W > 600 ? 32 : 24;
  const cx = W / 2;
  const laneX = (k: number) => (k === 0 ? cx : cx + (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * LW);
  const laneSide = (k: number) => (k === 0 ? 0 : k % 2 === 1 ? 1 : -1);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => save('tl-ppd2', ppdState), [ppdState]);
  useEffect(() => save('tl-mode', mode), [mode]);

  const svgTop = () => (wrap.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
  const applyAnchor = useCallback(() => {
    const a = anchor.current;
    if (a) window.scrollTo(0, svgTop() + TOP + a.day * ppd - a.screenY);
  }, [ppd]);
  useLayoutEffect(() => { applyAnchor(); }, [ppd, applyAnchor]);
  useEffect(() => {
    if (today >= 0 && today <= maxDay) {
      anchor.current = { day: today, screenY: window.innerHeight * 0.35 };
      applyAnchor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomTo = (next: number, screenY: number) => {
    const n = clamp(next, fitPpd, MAX_PPD);
    if (Math.abs(n - ppd) < 0.01) return;
    anchor.current = { day: (window.scrollY + screenY - svgTop() - TOP) / ppd, screenY };
    setPpd(n);
  };
  const fit = () => {
    anchor.current = { day: 0, screenY: HH + TOP };
    setPpd(fitPpd);
  };
  const onDown = (e: React.PointerEvent) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), ppd };
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      zoomTo(pinch.current.ppd * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d), (a.y + b.y) / 2);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
  };

  const useCountry = mode === 'country' || (mode === 'auto' && ppd <= fitPpd * 1.2);
  const countries = useMemo(() => {
    const order: string[] = [];
    const seq = [...s.path.map((id) => plan.stops[id]), ...stops.filter((x) => !s.onPath.has(x.id))];
    for (const x of seq) {
      const c = countryOf(x);
      if (c && !order.includes(c)) order.push(c);
    }
    return order;
  }, [plan, s, stops]);
  const colorOf = (id: string) => {
    const i = useCountry ? (() => { const c = countryOf(plan.stops[id]); return c ? countries.indexOf(c) % 8 : -1; })() : ci[id];
    return i < 0 ? 'var(--alt)' : `var(--c${i})`;
  };

  // geometry per stop
  const geo = (id: string) => {
    const st = plan.stops[id];
    const al = activeOutLeg(plan, id);
    const ov = !!al && legOvernight(al) && st.nights > 0;
    const hotel = st.nights - (ov ? 1 : 0);
    const dots = Math.max(hotel, 1);
    const a = s.arrive[id];
    return { st, hotel, dots, a, lastDay: a + dots - 1, hollow: hotel === 0 };
  };

  // date ticks
  const step = [1, 2, 7, 14, 30].find((n) => n * ppd >= 22) ?? 30;
  const ticks = Array.from({ length: maxDay + 1 }, (_, i) => {
    const d = addDays(plan.start, i);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    const dayNum = Number(d.slice(8));
    const month = dayNum === 1 || i === 0;
    const label = month || step === 1 || (step === 2 && i % 2 === 0) || (step === 7 && dow === 1) || (step > 7 && dow === 1 && i % 14 === 1);
    return { i, d, dow, dayNum, month, label };
  });

  // labels
  type L = { id: string; y: number; side: -1 | 1; lane: number };
  const raw: L[] = [];
  const altOnSide = (side: number, d0: number, d1: number) =>
    stops.some((x) => lane[x.id] !== 0 && laneSide(lane[x.id]) === side && s.arrive[x.id] < d1 && s.arrive[x.id] + Math.max(x.nights, 1) > d0);
  s.path.forEach((id, i) => {
    const g = geo(id);
    const pref: -1 | 1 = i % 2 === 0 ? 1 : -1;
    let side = pref;
    if (altOnSide(pref, g.a, g.a + Math.max(g.st.nights, 1))) side = (-pref) as -1 | 1;
    raw.push({ id, y: Y(g.a), side, lane: 0 });
  });
  stops.filter((x) => !s.onPath.has(x.id)).forEach((x) => {
    raw.push({ id: x.id, y: Y(s.arrive[x.id]), side: (laneSide(lane[x.id]) || 1) as -1 | 1, lane: lane[x.id] });
  });
  const labels = ([-1, 1] as const).flatMap((side) => {
    const list = raw.filter((r) => r.side === side).sort((a, b) => a.y - b.y);
    return list.map((r, k) => {
      const avail = list[k + 1] ? list[k + 1].y - r.y : 999;
      const lines = avail >= 32 && ppd >= 15 ? 2 : avail >= 15 ? 1 : 0;
      return { ...r, lines };
    }).filter((r) => r.lines > 0);
  });

  const inLeg = (id: string) => {
    const i = ins(plan, id);
    return i.find((l) => s.activeLegs.has(l.id)) ?? i[0];
  };

  const rd = clamp(ppd * 0.26, 2.2, 5);
  const showDots = ppd >= 9;

  return (
    <div className="tl-wrap" ref={wrap} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <svg width={W} height={H} role="img" aria-label="Trip timeline">
        {ticks.map((t) => {
          const isToday = t.i === today;
          return (
            <g key={t.i}>
              {(ppd >= 14 || t.month || t.dow === 1) && (
                <line x1={AXIS} x2={W - 4} y1={Y(t.i)} y2={Y(t.i)} className={t.month ? 'g-line month' : t.dow === 1 ? 'g-line week' : 'g-line'} />
              )}
              {(t.label || isToday) && (
                <text x={4} y={Y(t.i) + 3.5} className={isToday ? 'g-todaylbl' : t.month ? 'g-mon' : 'g-tick'}>
                  {isToday ? 'today' : t.month ? (t.dayNum === 1 ? fmtMonthName(t.d) : `${t.dayNum} ${fmtMonthName(t.d)}`) : t.dayNum}
                </text>
              )}
            </g>
          );
        })}
        {today >= 0 && today <= maxDay && <rect x={0} y={Y(today) - Math.max(ppd, 8) / 2} width={W} height={Math.max(ppd, 8)} className="g-today" />}
        <line x1={AXIS} x2={W - 4} y1={Y(days)} y2={Y(days)} className="g-end" />

        {liveLegs(plan).map((l) => {
          if (s.arrive[l.from] === undefined || s.arrive[l.to] === undefined) return null;
          const g = geo(l.from);
          const x1 = laneX(lane[l.from]);
          const x2 = laneX(lane[l.to]);
          const y1 = Y(g.lastDay);
          const y2 = Y(s.arrive[l.to]);
          const active = s.activeLegs.has(l.id);
          const o = chosenOption(l);
          const ov = legOvernight(l) && g.st.nights > 0;
          const branchOut = lane[l.from] === 0 && lane[l.to] !== 0;
          const R = x1 === x2 ? 0 : Math.max(1, Math.min(6, Math.max(y2 - y1, 2) / 2, Math.abs(x2 - x1) / 2));
          const v0 = branchOut ? y1 + 2 * R : y1;
          const v1 = branchOut ? y2 : y2 - 2 * R;
          const iy = (v0 + v1) / 2;
          const sz = ppd >= 18 ? 16 : 13;
          const iLane = branchOut ? lane[l.to] : lane[l.from];
          const side = iLane === 0 ? -1 : laneSide(iLane);
          const ix = (branchOut ? x2 : x1) + side * (6 + sz / 2);
          const room = v1 - v0;
          return (
            <g key={l.id} opacity={active ? 1 : 0.7} onClick={() => go({ view: 'place', id: l.from })} className="g-badge">
              <path d={connector(x1, y1, x2, y2, branchOut)} fill="none" stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
              {o && ppd >= 12 && room >= sz - 2 && (
                <g color="var(--ink)">
                  <g transform={`translate(${ix - sz / 2},${iy - sz / 2 - (ov ? sz * 0.6 : 0)}) scale(${sz / 24})`}>
                    <path d={iconPath(modeIcon(o.mode))} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  {ov && (
                    <g transform={`translate(${ix - sz / 2},${iy - sz / 2 + sz * 0.7}) scale(${sz / 24})`} className="g-moon">
                      <path d={iconPath('moon')} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinejoin="round" />
                    </g>
                  )}
                </g>
              )}
            </g>
          );
        })}

        {stops.map((x) => {
          const g = geo(x.id);
          const px = laneX(lane[x.id]);
          const on = s.onPath.has(x.id);
          const past = g.a + x.nights < today;
          const col = colorOf(x.id);
          const y0 = Y(g.a);
          return (
            <g key={x.id} className="g-node" opacity={past ? 0.5 : on ? 1 : 0.8} onClick={() => go({ view: 'place', id: x.id })}>
              {g.dots > 1 && <line x1={px} x2={px} y1={y0} y2={Y(g.lastDay)} stroke={col} strokeWidth={showDots ? 3 : clamp(ppd * 0.5, 3, 6)} strokeLinecap="round" />}
              {showDots && Array.from({ length: g.dots - 1 }, (_, k) => (
                <circle key={k} cx={px} cy={Y(g.a + k + 1)} r={rd} fill={col} stroke="var(--bg)" strokeWidth={1.5} />
              ))}
              <circle cx={px} cy={y0} r={rd + 2.5} fill={g.hollow ? 'var(--bg)' : col} stroke={g.hollow ? col : 'var(--bg)'} strokeWidth={g.hollow ? 2.5 : 2} />
              <rect x={px - LW / 2} y={y0 - 8} width={LW} height={Math.max(Y(g.lastDay) - y0, 0) + 16} fill="transparent" />
            </g>
          );
        })}

        {labels.map(({ id, y, side, lane: l, lines }) => {
          const x = plan.stops[id];
          const on = s.onPath.has(id);
          const px = laneX(l);
          const edge = px + side * 30;
          const room = side === 1 ? W - edge - 6 : edge - AXIS - 10;
          const past = s.arrive[id] + x.nights < today;
          const il = inLeg(id);
          const o = il ? chosenOption(il) : null;
          const sub = [
            `${fmtShortDate(addDays(plan.start, s.arrive[id]))}–${fmtShortDate(addDays(plan.start, s.arrive[id] + x.nights))}`,
            o ? `${o.mode}${o.duration ? ` ${o.duration}` : ''}` : '',
          ].filter(Boolean).join(' · ');
          const anchorT = side === 1 ? 'start' : 'end';
          return (
            <g key={`t-${id}`} className="g-label" opacity={past ? 0.5 : on ? 1 : 0.85} onClick={() => go({ view: 'place', id })}>
              <text x={edge} y={y + 4.5} textAnchor={anchorT} className="g-name">
                {trunc(x.name || '…', room - 26, 7.2)}
                <tspan className="g-n"> {x.nights}n</tspan>
                {!on && <tspan className="g-n"> alt</tspan>}
              </text>
              {lines === 2 && <text x={edge} y={y + 19} textAnchor={anchorT} className="g-sub">{trunc(sub, room, 5.5)}</text>}
            </g>
          );
        })}
      </svg>

      <div className="tl-ctl">
        <button aria-label="zoom out" onClick={() => zoomTo(ppd / 1.4, window.innerHeight / 2)}><Icon name="minus" size={20} /></button>
        <button aria-label="zoom in" onClick={() => zoomTo(ppd * 1.4, window.innerHeight / 2)}><Icon name="plus" size={20} /></button>
        <button aria-label="fit whole trip" onClick={fit}><Icon name="fit" size={20} /></button>
      </div>
      <button className="tl-mode" onClick={() => setMode(NEXT_MODE[mode])}>{MODE_LABEL[mode]}</button>
    </div>
  );
}
