import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { countryOf } from '../cities';
import { addDays, diffDays, fmtMonthName, fmtShortDate, todayStr } from '../dates';
import { Icon, iconPath } from '../icons';
import {
  activeOutLeg, chosenOption, colorIndex, ins, lanes, legOvernight, liveLegs, liveStops, schedule,
} from '../model';
import { go } from '../nav';
import { useStore } from '../store';

const DATE_W = 44;
const STRIP = 14;
const TOP = 16;
const MIN_PPD = 4;
const MAX_PPD = 56;

type ColorMode = 'auto' | 'country' | 'stop';
const NEXT_MODE: Record<ColorMode, ColorMode> = { auto: 'country', country: 'stop', stop: 'auto' };
const MODE_LABEL: Record<ColorMode, string> = { auto: 'Auto colour', country: 'By country', stop: 'By stop' };

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'narrow', timeZone: 'UTC' });
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

export function Timeline() {
  const { plan } = useStore();
  const s = useMemo(() => schedule(plan), [plan]);
  const lane = useMemo(() => lanes(plan, s), [plan, s]);
  const ci = useMemo(() => colorIndex(plan, s), [plan, s]);
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(() => Math.min(window.innerWidth, 820));
  const [ppd, setPpd] = useState<number>(() => clamp(load('tl-ppd', 28), MIN_PPD, MAX_PPD));
  const [mode, setMode] = useState<ColorMode>(() => load<ColorMode>('tl-mode', 'auto'));
  const anchor = useRef<{ day: number; screenY: number } | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; ppd: number } | null>(null);

  const days = Math.max(diffDays(plan.start, plan.end), 1);
  const today = diffDays(plan.start, todayStr());
  const stops = useMemo(() => liveStops(plan).filter((x) => s.arrive[x.id] !== undefined), [plan, s]);
  const maxDay = Math.max(days, ...stops.map((x) => s.arrive[x.id] + x.nights));
  const nLanes = Math.max(1, ...stops.map((x) => lane[x.id] + 1));

  const LW = W > 600 ? 26 : 20;
  const lane0 = DATE_W + STRIP + 18;
  const labelX0 = lane0 + (nLanes - 1) * LW + 22;
  const labelW = W - labelX0 - 8;
  const colW = labelW / nLanes;
  const Y = (d: number) => TOP + d * ppd;
  const X = (l: number) => lane0 + l * LW;
  const H = Y(maxDay + 1) + 40;
  const rw = clamp(ppd * 0.4, 4, 9);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => save('tl-ppd', ppd), [ppd]);
  useEffect(() => save('tl-mode', mode), [mode]);

  const svgTop = () => (wrap.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
  const applyAnchor = useCallback(() => {
    const a = anchor.current;
    if (!a) return;
    window.scrollTo(0, svgTop() + TOP + a.day * ppd - a.screenY);
  }, [ppd]);

  useLayoutEffect(() => {
    applyAnchor();
  }, [ppd, applyAnchor]);

  useEffect(() => {
    if (today >= 0 && today <= maxDay) {
      anchor.current = { day: today, screenY: window.innerHeight * 0.35 };
      applyAnchor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomTo = (next: number, screenY: number) => {
    const n = clamp(next, MIN_PPD, MAX_PPD);
    if (n === ppd) return;
    anchor.current = { day: (window.scrollY + screenY - svgTop() - TOP) / ppd, screenY };
    setPpd(n);
  };
  const fit = () => {
    const avail = window.innerHeight - 46 - 54 - TOP - 70;
    anchor.current = { day: 0, screenY: 46 + TOP };
    setPpd(clamp(avail / (maxDay + 1), MIN_PPD, MAX_PPD));
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
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const next = clamp(pinch.current.ppd * (d / pinch.current.d), MIN_PPD, MAX_PPD);
      const midY = (a.y + b.y) / 2;
      if (Math.abs(next - ppd) > 0.4) {
        anchor.current = { day: (window.scrollY + midY - svgTop() - TOP) / ppd, screenY: midY };
        setPpd(next);
      }
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
  };

  const useCountry = mode === 'country' || (mode === 'auto' && ppd < 14);
  const countries = useMemo(() => {
    const order: string[] = [];
    const seq = [...s.path.map((id) => plan.stops[id]), ...stops.filter((x) => !s.onPath.has(x.id))];
    for (const x of seq) {
      const c = countryOf(x);
      if (c && !order.includes(c)) order.push(c);
    }
    return order;
  }, [plan, s, stops]);
  const cIdx = (c: string) => (c ? countries.indexOf(c) % 8 : -1);
  const colorOf = (id: string) => {
    const i = useCountry ? cIdx(countryOf(plan.stops[id])) : ci[id];
    return i < 0 ? 'var(--alt)' : `var(--c${i})`;
  };

  // country bands along the active route
  const bands: { c: string; y0: number; y1: number }[] = [];
  for (const id of s.path) {
    const c = countryOf(plan.stops[id]);
    const y0 = Y(s.arrive[id]);
    const y1 = Y(s.arrive[id] + plan.stops[id].nights);
    const last = bands[bands.length - 1];
    if (last && last.c === c) last.y1 = y1;
    else bands.push({ c, y0, y1 });
  }

  // date ticks
  const step = [1, 2, 7, 14, 30].find((n) => n * ppd >= 26) ?? 30;
  const ticks = Array.from({ length: maxDay + 1 }, (_, i) => {
    const d = addDays(plan.start, i);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    const dayNum = Number(d.slice(8));
    const month = dayNum === 1 || i === 0;
    const label = step === 1 || (step === 2 && i % 2 === 0) || (step === 7 && dow === 1) || month || (step > 7 && dow === 1 && i % 14 === 1);
    return { i, d, dow, dayNum, month, label: label && (step < 14 || month) };
  });

  // labels per lane
  const byLane: Record<number, typeof stops> = {};
  stops.forEach((x) => (byLane[lane[x.id]] ??= []).push(x));
  const labels = Object.entries(byLane).flatMap(([l, list]) => {
    const sorted = [...list].sort((a, b) => s.arrive[a.id] - s.arrive[b.id]);
    return sorted.map((x, k) => {
      const y = Y(s.arrive[x.id]);
      const next = sorted[k + 1];
      const avail = next ? Y(s.arrive[next.id]) - y : 999;
      const lines = avail >= 31 && ppd >= 16 ? 2 : avail >= 14 ? 1 : 0;
      return { x, y, lines, lane: Number(l) };
    }).filter((t) => t.lines > 0);
  });

  const overnightOut = (id: string) => {
    const l = activeOutLeg(plan, id);
    return !!l && legOvernight(l) && plan.stops[id].nights > 0;
  };
  const inLeg = (id: string) => {
    const i = ins(plan, id);
    return i.find((l) => s.activeLegs.has(l.id)) ?? i[0];
  };

  return (
    <div className="tl-wrap" ref={wrap} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <svg width={W} height={H} role="img" aria-label="Trip timeline">
        {ticks.map((t) => (
          <g key={t.i}>
            {(ppd >= 12 || t.month || t.dow === 1) && (
              <line x1={DATE_W - 2} x2={W - 4} y1={Y(t.i)} y2={Y(t.i)} className={t.month ? 'g-line month' : t.dow === 1 ? 'g-line week' : 'g-line'} />
            )}
            {t.label && (
              <text x={DATE_W - 6} y={Y(t.i) + 11} textAnchor="end" className={t.month ? 'g-mon' : 'g-tick'}>
                {t.month ? (ppd >= 12 || t.dayNum === 1 ? `${t.dayNum === 1 ? '' : `${t.dayNum} `}${fmtMonthName(t.d)}` : t.dayNum) : t.dayNum}
                {step === 1 && !t.month && <tspan className="wd"> {WEEKDAY.format(new Date(`${t.d}T00:00:00Z`))}</tspan>}
              </text>
            )}
          </g>
        ))}

        {today >= 0 && today <= maxDay && (
          <g>
            <rect x={0} y={Y(today)} width={W} height={Math.max(ppd, 5)} className="g-today" />
            <text x={DATE_W - 6} y={Y(today) - 3} textAnchor="end" className="g-todaylbl">today</text>
          </g>
        )}
        <line x1={DATE_W - 2} x2={W - 4} y1={Y(days)} y2={Y(days)} className="g-end" />

        {bands.map((b, k) => {
          const idx = cIdx(b.c);
          const h = b.y1 - b.y0;
          return (
            <g key={k}>
              <rect x={DATE_W} y={b.y0 + 1} width={STRIP} height={Math.max(h - 2, 2)} rx={4} fill={idx < 0 ? 'var(--alt)' : `var(--c${idx})`} opacity={useCountry ? 1 : 0.85} />
              {b.c && h >= 34 && (
                <text transform={`translate(${DATE_W + STRIP / 2 + 3.5},${b.y0 + h / 2}) rotate(-90)`} textAnchor="middle" className="g-country">
                  {trunc(b.c, h - 10, 5.6)}
                </text>
              )}
            </g>
          );
        })}

        {liveLegs(plan).map((l) => {
          if (s.arrive[l.from] === undefined || s.arrive[l.to] === undefined) return null;
          const fa = plan.stops[l.from];
          const ov = legOvernight(l) && fa.nights > 0;
          const x1 = X(lane[l.from]);
          const x2 = X(lane[l.to]);
          const y1 = Y(s.arrive[l.from] + fa.nights - (ov ? 1 : 0));
          const y2 = Y(s.arrive[l.to]);
          const active = s.activeLegs.has(l.id);
          const R = Math.max(2, Math.min(16, Math.abs(y2 - y1) / 2));
          let d: string;
          if (x1 === x2) d = `M${x1},${y1} L${x2},${y2}`;
          else if (x2 > x1) d = `M${x1},${y1} C${x1},${y1 + R} ${x2},${y1 + R} ${x2},${y1 + 2 * R} L${x2},${y2}`;
          else d = `M${x1},${y1} L${x1},${y2 - 2 * R} C${x1},${y2 - R} ${x2},${y2 - R} ${x2},${y2}`;
          return (
            <g key={l.id}>
              <path d={d} fill="none" stroke={colorOf(l.from)} strokeWidth={active ? 2.5 : 2} strokeDasharray={active ? undefined : '4 4'} opacity={active ? 1 : 0.6} />
              {ov && ppd >= 14 && (
                <g transform={`translate(${x1 + 6},${(y1 + y2) / 2 - 6}) scale(0.5)`} className="g-moon">
                  <path d={iconPath('moon')} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinejoin="round" />
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
          const y0 = Y(s.arrive[x.id]);
          const y1 = Y(s.arrive[x.id] + hotel);
          const past = s.arrive[x.id] + x.nights < today;
          const col = colorOf(x.id);
          return (
            <g key={x.id} className="g-node" opacity={past ? 0.55 : on ? 1 : 0.7} onClick={() => go({ view: 'place', id: x.id })}>
              {y1 > y0 && <line x1={X(l)} x2={X(l)} y1={y0} y2={y1} stroke={col} strokeWidth={rw} strokeLinecap="round" />}
              <circle cx={X(l)} cy={y0} r={rw / 2 + 2} fill={col} stroke="var(--bg)" strokeWidth={2} />
              <rect x={X(l) - LW / 2} y={y0 - 4} width={LW} height={Math.max(y1 - y0, 0) + 8} fill="transparent" />
            </g>
          );
        })}

        {labels.map(({ x, y, lines, lane: l }) => {
          const on = s.onPath.has(x.id);
          const px = labelX0 + l * colW;
          const crowded = nLanes > 1 && labels.some((o) => o.lane !== l && Math.abs(o.y - y) < 36);
          const w = (crowded || l > 0 ? colW : labelW) - 6;
          const past = s.arrive[x.id] + x.nights < today;
          const il = inLeg(x.id);
          const o = il ? chosenOption(il) : null;
          const arr = addDays(plan.start, s.arrive[x.id]);
          const dep = addDays(plan.start, s.arrive[x.id] + x.nights);
          const country = countryOf(x);
          const hn = x.nights - (overnightOut(x.id) ? 1 : 0);
          const sub = [
            `${fmtShortDate(arr)}–${fmtShortDate(dep)}`,
            o ? `${o.mode}${o.duration ? ` ${o.duration}` : ''}` : '',
          ].filter(Boolean).join(' · ');
          return (
            <g key={`t-${x.id}`} className="g-label" opacity={past ? 0.55 : on ? 1 : 0.75} onClick={() => go({ view: 'place', id: x.id })}>
              <text x={px} y={y + 5} className="g-name">
                {trunc(x.name || '…', w - 34, 7.2)}
                <tspan className="g-n"> {x.nights}n</tspan>
                {!on && <tspan className="g-n"> alt</tspan>}
              </text>
              {lines === 2 && (
                <>
                  <text x={px} y={y + 20} className="g-sub">{trunc(sub + (country && ppd >= 24 ? ` · ${country}` : ''), w - (hn > 0 ? 20 : 0), 5.6)}</text>
                  {hn > 0 && (
                    <g transform={`translate(${px + w - 14},${y - 5}) scale(0.58)`} className={x.accomBooked ? 'g-ok' : 'g-warn'}>
                      <path d={iconPath('bed')} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  )}
                </>
              )}
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
