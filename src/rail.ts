import { haversineKm, type Pt } from './estimate';

type Station = [name: string, lat: number, lng: number];

// Rough station positions; only needs to look right at country zoom.
const ST: Record<string, Station> = {
  vte: ['Vientiane', 18.02, 102.7],
  thn: ['Thanaleng', 17.93, 102.64],
  nkh: ['Nong Khai', 17.88, 102.74],
  vv: ['Vang Vieng', 18.96, 102.44],
  lpb: ['Luang Prabang', 19.94, 102.19],
  mxy: ['Muang Xai', 20.7, 101.99],
  nat: ['Nateuy', 21.05, 101.72],
  bot: ['Boten', 21.153, 101.67],
  moh: ['Mohan', 21.2, 101.69],
  mel: ['Mengla', 21.48, 101.57],
  jhg: ['Jinghong', 22.0, 100.8],
  pre: ['Pu\'er', 22.78, 100.97],
  yux: ['Yuxi', 24.35, 102.54],
  kms: ['Kunming South', 24.98, 102.8],
  cxi: ['Chuxiong', 25.04, 101.55],
  dal: ['Dali', 25.59, 100.23],
  lij: ['Lijiang', 26.85, 100.22],
  sgl: ['Shangri-La', 27.83, 99.7],
  bkk: ['Bangkok', 13.804, 100.54],
  ayu: ['Ayutthaya', 14.35, 100.58],
  lop: ['Lopburi', 14.8, 100.62],
  nsw: ['Nakhon Sawan', 15.69, 100.12],
  phs: ['Phitsanulok', 16.82, 100.26],
  utt: ['Uttaradit', 17.62, 100.1],
  dch: ['Den Chai', 17.99, 100.05],
  lmp: ['Lampang', 18.29, 99.49],
  lam: ['Lamphun', 18.58, 99.01],
  cnx: ['Chiang Mai', 18.78, 98.99],
  sar: ['Saraburi', 14.53, 100.91],
  pch: ['Pak Chong', 14.71, 101.41],
  kor: ['Nakhon Ratchasima', 14.98, 102.1],
  kkn: ['Khon Kaen', 16.43, 102.83],
  udn: ['Udon Thani', 17.41, 102.79],
};

// Ordered station ids per line. Shared ids are interchanges.
const LINES: string[][] = [
  ['vte', 'vv', 'lpb', 'mxy', 'nat', 'bot', 'moh', 'mel', 'jhg', 'pre', 'yux', 'kms'],
  ['kms', 'cxi', 'dal', 'lij', 'sgl'],
  ['bkk', 'ayu', 'lop', 'nsw', 'phs', 'utt', 'dch', 'lmp', 'lam', 'cnx'],
  ['bkk', 'ayu', 'sar', 'pch', 'kor', 'kkn', 'udn', 'nkh', 'thn', 'vte'],
];

const pt = (id: string): Pt => ({ lat: ST[id][1], lng: ST[id][2] });
const adj: Record<string, [string, number][]> = {};
for (const l of LINES)
  for (let i = 0; i + 1 < l.length; i++) {
    const w = haversineKm(pt(l[i]), pt(l[i + 1]));
    (adj[l[i]] ??= []).push([l[i + 1], w]);
    (adj[l[i + 1]] ??= []).push([l[i], w]);
  }

const SNAP_KM = 60;
const nearest = (p: Pt): string | null => {
  let best: string | null = null;
  let bd = SNAP_KM;
  for (const id of Object.keys(ST)) {
    const d = haversineKm(p, pt(id));
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
};

export function bundledRail(a: Pt, b: Pt): [number, number][] | null {
  const s = nearest(a);
  const t = nearest(b);
  if (!s || !t || s === t) return null;
  const dist: Record<string, number> = { [s]: 0 };
  const prev: Record<string, string> = {};
  const todo = new Set(Object.keys(ST));
  while (todo.size) {
    let u: string | null = null;
    for (const id of todo) if (dist[id] !== undefined && (u === null || dist[id] < dist[u])) u = id;
    if (u === null || u === t) break;
    todo.delete(u);
    for (const [v, w] of adj[u] ?? []) {
      if (dist[u] + w < (dist[v] ?? Infinity)) {
        dist[v] = dist[u] + w;
        prev[v] = u;
      }
    }
  }
  if (dist[t] === undefined) return null;
  const ids: string[] = [];
  for (let c: string | undefined = t; c; c = prev[c]) ids.unshift(c);
  return [[a.lat, a.lng], ...ids.map((id): [number, number] => [ST[id][1], ST[id][2]]), [b.lat, b.lng]];
}
