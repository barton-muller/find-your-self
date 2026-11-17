import { get, set } from 'idb-keyval';
import { useEffect, useMemo, useState } from 'react';
import { addDays, todayStr } from './dates';

export type WxKind = 'sun' | 'cloud' | 'rain';
export interface Wx {
  kind: WxKind;
  mm: number;
  hi: number | null;
}
export type WxDays = Record<string, Wx>;
export interface WxReq {
  key: string;
  lat: number;
  lng: number;
  dates: string[];
}

type Cache = Record<string, { t: number; days: WxDays }>;

const KEY = 'wx-v2';
const TTL = 3 * 3600e3;
const HORIZON = 15;

export const locKey = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;
export const rainLevel = (mm: number): 1 | 2 | 3 => (mm < 3 ? 1 : mm < 10 ? 2 : 3);

interface DailyFc {
  time: string[];
  weather_code: (number | null)[];
  precipitation_sum: (number | null)[];
  temperature_2m_max: (number | null)[];
}

const getJson = async <T>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
};

const q = (lat: number, lng: number, from: string, to: string, daily: string) =>
  `latitude=${lat}&longitude=${lng}&daily=${daily}&timezone=auto&start_date=${from}&end_date=${to}`;

async function fetchForecast(lat: number, lng: number, from: string, to: string): Promise<WxDays> {
  const j = await getJson<{ daily: DailyFc }>(
    `https://api.open-meteo.com/v1/forecast?${q(lat, lng, from, to, 'weather_code,precipitation_sum,temperature_2m_max')}`,
  );
  const out: WxDays = {};
  j.daily.time.forEach((d, i) => {
    const mm = j.daily.precipitation_sum[i] ?? 0;
    const code = j.daily.weather_code[i] ?? 0;
    out[d] = { kind: mm >= 1 || code >= 95 ? 'rain' : code >= 3 ? 'cloud' : 'sun', mm, hi: j.daily.temperature_2m_max[i] };
  });
  return out;
}

const span = (ds: string[]) => [ds.reduce((a, b) => (a < b ? a : b)), ds.reduce((a, b) => (a > b ? a : b))] as const;

export function useWeather(reqs: WxReq[], enabled: boolean): Record<string, WxDays> {
  const [data, setData] = useState<Record<string, WxDays>>({});
  const sig = useMemo(() => JSON.stringify(reqs), [reqs]);

  useEffect(() => {
    if (!enabled) return;
    let off = false;
    const list = JSON.parse(sig) as WxReq[];
    (async () => {
      let cache: Cache = {};
      try { cache = (await get<Cache>(KEY)) ?? {}; } catch { /* ignore */ }
      const publish = () => {
        if (off) return;
        const next: Record<string, WxDays> = {};
        for (const r of list) next[r.key] = cache[r.key]?.days ?? {};
        setData(next);
      };
      publish();
      const today = todayStr();
      const limit = addDays(today, HORIZON);
      const job = async (r: WxReq) => {
        const e = cache[r.key];
        const ds = r.dates.filter((d) => d >= today && d <= limit);
        if (!ds.length || (e && Date.now() - e.t < TTL && ds.every((d) => e.days[d]))) return;
        try {
          const [a, b] = span(ds);
          cache[r.key] = { t: Date.now(), days: { ...e?.days, ...(await fetchForecast(r.lat, r.lng, a, b)) } };
          publish();
        } catch { /* offline: keep cached */ }
      };
      const queue = [...list];
      await Promise.all(Array.from({ length: 4 }, async () => {
        for (let r = queue.shift(); r && !off; r = queue.shift()) await job(r);
      }));
      try { await set(KEY, cache); } catch { /* ignore */ }
    })();
    return () => { off = true; };
  }, [sig, enabled]);

  return data;
}
