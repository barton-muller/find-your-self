import { addDays, todayStr } from './dates';
import { liveStops, schedule } from './model';
import type { Plan } from './types';

const CODES: [number, string][] = [
  [0, 'clear'], [1, 'mostly clear'], [2, 'partly cloudy'], [3, 'overcast'], [45, 'fog'], [48, 'fog'],
  [51, 'drizzle'], [53, 'drizzle'], [55, 'drizzle'], [56, 'freezing drizzle'], [57, 'freezing drizzle'],
  [61, 'light rain'], [63, 'rain'], [65, 'heavy rain'], [66, 'freezing rain'], [67, 'freezing rain'],
  [71, 'light snow'], [73, 'snow'], [75, 'heavy snow'], [77, 'snow grains'],
  [80, 'showers'], [81, 'showers'], [82, 'heavy showers'], [85, 'snow showers'], [86, 'snow showers'],
  [95, 'thunderstorm'], [96, 'thunderstorm, hail'], [99, 'thunderstorm, hail'],
];
const desc = (c: number | null) => c === null ? '?' : CODES.find(([k]) => k === c)?.[1] ?? `code ${c}`;
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const key = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

interface Daily {
  time: string[];
  weather_code: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  precipitation_probability_max: (number | null)[];
}

export async function weatherReport(plan: Plan): Promise<string> {
  const s = schedule(plan);
  const stops = liveStops(plan)
    .filter((x) => x.lat !== null && x.lng !== null && s.arrive[x.id] !== undefined)
    .map((x) => ({ x, from: addDays(plan.start, s.arrive[x.id]), to: addDays(plan.start, s.arrive[x.id] + x.nights), on: s.path.includes(x.id) }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const today = todayStr();
  const live = stops.filter((r) => r.to >= today);
  const uniq = [...new Map(live.map((r) => [key(r.x.lat!, r.x.lng!), r.x])).values()];
  if (!uniq.length) return 'No upcoming stops with coordinates.';
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=' + uniq.map((x) => x.lat!.toFixed(3)).join(',') +
    '&longitude=' + uniq.map((x) => x.lng!.toFixed(3)).join(',') +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=16';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  const j = await r.json();
  const arr: { daily: Daily }[] = Array.isArray(j) ? j : [j];
  const by = new Map(uniq.map((x, i) => [key(x.lat!, x.lng!), arr[i].daily]));
  const out: string[] = [
    `Weather forecast from Open-Meteo, fetched ${new Date().toLocaleString('en-GB')}. Units: C, mm. Row: day, high/low, rain mm, rain chance, conditions.`,
    `Plan ${plan.start} to ${plan.end}. "alt" marks stops on an inactive branch (dates are their earliest possible arrival).`,
    '',
  ];
  for (const r2 of live) {
    const d = by.get(key(r2.x.lat!, r2.x.lng!))!;
    out.push(`${r2.x.name || 'Unnamed'}${r2.on ? '' : ' (alt)'}, ${r2.x.nights}n, ${day(r2.from)} to ${day(r2.to)}`);
    const idx = d.time.map((t, i) => [t, i] as const).filter(([t, i]) => t >= r2.from && t <= r2.to && d.temperature_2m_max[i] !== null && d.temperature_2m_min[i] !== null);
    if (!idx.length) {
      out.push('  no forecast available yet (beyond the ~15-day window)');
      continue;
    }
    for (const [t, i] of idx) {
      const p = d.precipitation_probability_max[i];
      out.push(`  ${day(t)}: ${Math.round(d.temperature_2m_max[i]!)}/${Math.round(d.temperature_2m_min[i]!)}, ${d.precipitation_sum[i] ?? '?'}mm, ${p === null || p === undefined ? '?' : p + '%'}, ${desc(d.weather_code[i])}`);
    }
  }
  return out.join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
