import { haversineKm, type Pt } from './estimate';

type Line = [number, number][];
interface Net {
  pts: [number, number][];
  adj: [number, number][][];
}

let net: Promise<Net> | null = null;

const build = async (): Promise<Net> => {
  const segs: Line[] = (await import('./data/rail-ne.json')).default as Line[];
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
  for (const s of segs)
    for (let i = 0; i + 1 < s.length; i++) {
      const a = id(s[i]);
      const b = id(s[i + 1]);
      if (a === b) continue;
      const w = haversineKm({ lat: pts[a][0], lng: pts[a][1] }, { lat: pts[b][0], lng: pts[b][1] });
      adj[a].push([b, w]);
      adj[b].push([a, w]);
    }
  return { pts, adj };
};

const SNAP_KM = 40;

export async function neRail(a: Pt, b: Pt): Promise<Line | null> {
  const { pts, adj } = await (net ??= build());
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
