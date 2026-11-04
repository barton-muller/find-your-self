import { useEffect, useRef, useState } from 'react';
import { CITIES } from '../cities';

export interface CityHit {
  name: string;
  sub: string;
  lat: number;
  lng: number;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const localHits = (q: string): CityHit[] => {
  const f = fold(q);
  if (!f) return [];
  const starts: CityHit[] = [];
  const has: CityHit[] = [];
  for (const [name, lat, lng] of CITIES) {
    const n = fold(name);
    const hit = { name, sub: '', lat, lng };
    if (n.startsWith(f)) starts.push(hit);
    else if (n.includes(f)) has.push(hit);
  }
  return [...starts, ...has].slice(0, 6);
};

interface GeoResult { name: string; latitude: number; longitude: number; country?: string; admin1?: string; population?: number }

async function onlineHits(q: string, signal: AbortSignal): Promise<CityHit[]> {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`,
    { signal },
  );
  if (!r.ok) return [];
  const j = (await r.json()) as { results?: GeoResult[] };
  return (j.results ?? []).map((x) => ({
    name: x.name,
    sub: [x.admin1, x.country].filter(Boolean).join(', '),
    lat: x.latitude,
    lng: x.longitude,
  }));
}

export function CitySearch({
  value, onType, onPick,
}: {
  value: string;
  onType: (v: string) => void;
  onPick: (h: CityHit) => void;
}) {
  const [focus, setFocus] = useState(false);
  const [online, setOnline] = useState<CityHit[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>(0);

  const local = focus ? localHits(value) : [];

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!focus || value.trim().length < 3 || !navigator.onLine) {
      setOnline([]);
      return;
    }
    const ctl = new AbortController();
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        setOnline(await onlineHits(value.trim(), ctl.signal));
      } catch {
        /* offline or aborted */
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer.current);
      ctl.abort();
    };
  }, [value, focus]);

  const extra = online.filter((o) => !local.some((l) => Math.abs(l.lat - o.lat) < 0.3 && Math.abs(l.lng - o.lng) < 0.3)).slice(0, 6);
  const all = [...local, ...extra];

  return (
    <div className="citysearch">
      <input
        className="title"
        value={value}
        placeholder="Search city…"
        autoComplete="off"
        autoCapitalize="words"
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onChange={(e) => onType(e.target.value)}
      />
      {focus && (all.length > 0 || busy) && (
        <ul className="suggest">
          {all.map((h, i) => (
            <li key={`${h.name}-${h.lat}-${i}`} onPointerDown={(e) => { e.preventDefault(); onPick(h); setFocus(false); }}>
              <b>{h.name}</b>
              {h.sub && <span> {h.sub}</span>}
            </li>
          ))}
          {busy && all.length === 0 && <li className="muted">Searching…</li>}
        </ul>
      )}
    </div>
  );
}
