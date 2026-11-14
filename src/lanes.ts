
import { haversineKm } from './estimate';
import type { LatLngTuple as Pt } from 'leaflet';

const sample = (line: Pt[], step = 3): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i], line[i + 1]];
    const d = haversineKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  out.push(line[line.length - 1]);
  return out;
};

const covered = (a: Pt[], b: Pt[]): { n: number; f: number } => {
  let n = 0;
  for (const p of a) {
    for (const q of b) {
      if (Math.abs(p[0] - q[0]) > 0.06 || Math.abs(p[1] - q[1]) > 0.06) continue;
      if (haversineKm({ lat: p[0], lng: p[1] }, { lat: q[0], lng: q[1] }) < 5) {
        n++;
        break;
      }
    }
  }
  return { n, f: n / a.length };
};

// Lane index per leg id; legs that share a corridor get distinct lanes.
export function laneIndex(legs: { id: string; pts: Pt[] }[]): Record<string, number> {
  const S = legs.map((l) => sample(l.pts));
  const parent = legs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < legs.length; i++)
    for (let j = i + 1; j < legs.length; j++) {
      const x = covered(S[i], S[j]);
      const y = covered(S[j], S[i]);
      if (Math.max(x.n, y.n) >= 4 && Math.max(x.f, y.f) >= 0.6) parent[find(i)] = find(j);
    }
  const groups = new Map<number, number[]>();
  legs.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  const out: Record<string, number> = {};
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => (legs[a].id < legs[b].id ? -1 : 1));
    g.forEach((i, r) => (out[legs[i].id] = r - (g.length - 1) / 2));
  }
  return out;
}

// Shift a polyline sideways by `px` screen pixels, independent of travel direction.
export function offsetLine(
  line: Pt[],
  px: number,
  project: (p: Pt) => { x: number; y: number },
  unproject: (x: number, y: number) => Pt,
): Pt[] {
  if (!px || line.length < 2) return line;
  const flip = line[0][0] + line[0][1] > line[line.length - 1][0] + line[line.length - 1][1];
  const base = flip ? [...line].reverse() : line;
  const P = base.map(project);
  const out = P.map((p, i) => {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(P.length - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    return unproject(p.x - (ty / len) * px, p.y + (tx / len) * px);
  });
  return flip ? out.reverse() : out;
}
