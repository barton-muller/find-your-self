import { haversineKm, type Pt } from './estimate';

type Line = [number, number][];
interface Net {
  pts: [number, number][];
  adj: [number, number][][];
}

const tileLoaders = import.meta.glob('./data/rail/*.json');
const tileCache = new Map<string, Promise<Line[]>>();
const nets = new Map<string, Net>();
const PAD = 1.5;
const MAX_TILES = 36;

const loadTile = (cx: number, cy: number): Promise<Line[]> => {
  const k = `${cx}_${cy}`;
  let p = tileCache.get(k);
  if (!p) {
    const ld = tileLoaders[`./data/rail/${k}.json`];
    p = ld ? ld().then((m) => (m as { default: Line[] }).default) : Promise.resolve([]);
    tileCache.set(k, p);
  }
  return p;
};

const build = (segs: Line[]): Net => {
  const idx = new Map<string, number>();
  const pts: [number, number][] = [];
  const adj: [number, number][][] = [];
  const id = (p: [number, number]) => {
    const k = `${p[0]},${p[1]}`;
    let i = idx.get(k);
    if (i === undefined) {
      i = pts.length;
      idx.set(k, i);
      pts.push(p);
      adj.push([]);
    }
    return i;
  };
  const seen = new Set<string>();
  for (const s of segs)
    for (let i = 0; i + 1 < s.length; i++) {
      const a = id(s[i]);
      const b = id(s[i + 1]);
      if (a === b) continue;
      const ek = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(ek)) continue;
      seen.add(ek);
      const w = haversineKm({ lat: pts[a][0], lng: pts[a][1] }, { lat: pts[b][0], lng: pts[b][1] });
      adj[a].push([b, w]);
      adj[b].push([a, w]);
    }
  return { pts, adj };
};

const netFor = async (a: Pt, b: Pt): Promise<Net | null> => {
  const x0 = Math.floor((Math.min(a.lng, b.lng) - PAD) / 10);
  const x1 = Math.floor((Math.max(a.lng, b.lng) + PAD) / 10);
  const y0 = Math.floor((Math.min(a.lat, b.lat) - PAD) / 10);
  const y1 = Math.floor((Math.max(a.lat, b.lat) + PAD) / 10);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES) return null;
  const key = `${x0},${x1},${y0},${y1}`;
  let n = nets.get(key);
  if (!n) {
    const jobs: Promise<Line[]>[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(loadTile(x, y));
    n = build((await Promise.all(jobs)).flat());
    nets.set(key, n);
  }
  return n;
};

const SNAP_KM = 40;

export async function neRail(a: Pt, b: Pt): Promise<Line | null> {
  const n = await netFor(a, b);
  if (!n) return null;
  const { pts, adj } = n;
  const snap = (p: Pt) => {
    let best = -1;
    let bd = SNAP_KM;
    for (let i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i][0] - p.lat) > 0.5 || Math.abs(pts[i][1] - p.lng) > 0.5) continue;
      const d = haversineKm(p, { lat: pts[i][0], lng: pts[i][1] });
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  const s = snap(a);
  const t = snap(b);
  if (s < 0 || t < 0 || s === t) return null;
  const dist = new Map<number, number>([[s, 0]]);
  const prev = new Map<number, number>();
  const heap: [number, number][] = [[0, s]];
  const push = (x: [number, number]) => {
    heap.push(x);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, u] = pop();
    if (u === t) break;
    if (d > (dist.get(u) ?? Infinity)) continue;
    for (const [v, w] of adj[u]) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
        push([nd, v]);
      }
    }
  }
  if (!dist.has(t)) return null;
  const path: Line = [];
  for (let c: number | undefined = t; c !== undefined; c = prev.get(c)) path.unshift(pts[c]);
  return [[a.lat, a.lng], ...path, [b.lat, b.lng]];
}
