import { get, set } from 'idb-keyval';
import { useEffect, useMemo, useState } from 'react';
import { addDays, todayStr } from './dates';

export type WxKind = 'sun' | 'cloud' | 'rain';
export interface Wx {
  kind: WxKind;
  mm: number;
  hi: number | null;
  est: boolean;
}
export type WxDays = Record<string, Wx>;
export interface WxReq {
  key: string;
  lat: number;
  lng: number;
  dates: string[];
}

interface Entry {
  fc?: { t: number; days: WxDays };
  cl?: { t: number; days: WxDays };
}
type Cache = Record<string, Entry>;

const KEY = 'wx-v1';
const FC_TTL = 3 * 3600e3;
const CL_TTL = 30 * 86400e3;
const HORIZON = 15;
const YEARS = 3;
const WINDOW = 3;

export const locKey = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;
export const rainLevel = (mm: number): 1 | 2 | 3 => (mm < 3 ? 1 : mm < 10 ? 2 : 3);

interface DailyFc {
  time: string[];
  weather_code: (number | null)[];
  precipitation_sum: (number | null)[];
  temperature_2m_max: (number | null)[];
}
interface DailyAr {
  time: string[];
  precipitation_sum: (number | null)[];
  cloud_cover_mean: (number | null)[];
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
    out[d] = { kind: mm >= 1 || code >= 95 ? 'rain' : code >= 3 ? 'cloud' : 'sun', mm, hi: j.daily.temperature_2m_max[i], est: false };
  });
  return out;
}

async function fetchClimate(lat: number, lng: number, from: string, to: string): Promise<WxDays> {
  const years = await Promise.all(
    Array.from({ length: YEARS }, (_, k) => {
      const off = -365 * (k + 1);
      return getJson<{ daily: DailyAr }>(
        `https://archive-api.open-meteo.com/v1/archive?${q(lat, lng, addDays(from, off - WINDOW), addDays(to, off + WINDOW), 'precipitation_sum,cloud_cover_mean,temperature_2m_max')}`,
      ).then((j) => ({ off, idx: new Map(j.daily.time.map((d, i) => [d, i])), d: j.daily }));
    }),
  );
  const out: WxDays = {};
  for (let d = from; d <= to; d = addDays(d, 1)) {
    let n = 0, wet = 0, mm = 0, cloud = 0, hi = 0, nh = 0;
    for (const y of years) {
      for (let w = -WINDOW; w <= WINDOW; w++) {
        const i = y.idx.get(addDays(d, y.off + w));
        const p = i === undefined ? null : y.d.precipitation_sum[i];
        if (i === undefined || p === null) continue;
        n++;
        mm += p;
        if (p >= 1) wet++;
        cloud += y.d.cloud_cover_mean[i] ?? 0;
        const t = y.d.temperature_2m_max[i];
        if (t !== null) { hi += t; nh++; }
      }
    }
    if (!n) continue;
    out[d] = {
      kind: wet / n >= 0.4 ? 'rain' : cloud / n >= 65 ? 'cloud' : 'sun',
      mm: mm / n,
      hi: nh ? hi / nh : null,
      est: true,
    };
  }
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
        for (const r of list) next[r.key] = { ...cache[r.key]?.cl?.days, ...cache[r.key]?.fc?.days };
        setData(next);
      };
      publish();
      const today = todayStr();
      const limit = addDays(today, HORIZON);
      const job = async (r: WxReq) => {
        const e = (cache[r.key] ??= {});
        const now = Date.now();
        const fut = r.dates.filter((d) => d >= today);
        const fcD = fut.filter((d) => d <= limit);
        const clD = fut.filter((d) => d > limit);
        try {
          if (fcD.length && (!e.fc || now - e.fc.t > FC_TTL || fcD.some((d) => !e.fc!.days[d]))) {
            const [a, b] = span(fcD);
            e.fc = { t: now, days: await fetchForecast(r.lat, r.lng, a, b) };
          }
        } catch { /* offline: keep cached */ }
        try {
          if (clD.length && (!e.cl || now - e.cl.t > CL_TTL || clD.some((d) => !e.cl!.days[d]))) {
            const [a, b] = span(clD);
            e.cl = { t: now, days: { ...e.cl?.days, ...(await fetchClimate(r.lat, r.lng, a, b)) } };
          }
        } catch { /* offline: keep cached */ }
        publish();
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
