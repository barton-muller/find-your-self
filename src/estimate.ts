export interface Pt { lat: number; lng: number }

export interface Suggestion {
  mode: string;
  duration: string;
  notes: string;
  overnight: boolean;
}

export const haversineKm = (a: Pt, b: Pt): number => {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

export const fmtHours = (h: number): string => {
  if (h >= 20) return `~${Math.round(h / 24 * 2) / 2 || 1} day${h >= 36 ? 's' : ''}`;
  const mins = Math.round((h * 60) / 15) * 15;
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  if (hh === 0) return `~${mm}m`;
  return mm === 0 ? `~${hh}h` : `~${hh}h${String(mm).padStart(2, '0')}`;
};

async function roadEstimate(a: Pt, b: Pt, straight: number): Promise<{ hours: number; km: number; source: 'road' | 'rough' }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`,
      { signal: ctl.signal },
    );
    clearTimeout(t);
    if (r.ok) {
      const j = await r.json();
      const rt = j.routes?.[0];
      if (rt) return { hours: rt.duration / 3600, km: rt.distance / 1000, source: 'road' };
    }
  } catch {
    /* fall through */
  }
  const km = straight * 1.3;
  return { hours: km / 65, km, source: 'rough' };
}

export async function suggest(a: Pt, b: Pt): Promise<Suggestion[]> {
  const straight = haversineKm(a, b);
  const out: Suggestion[] = [];
  const road = await roadEstimate(a, b, straight);
  const src = road.source === 'road' ? 'road routing' : 'straight-line guess';
  const km = Math.round(road.km / 10) * 10;

  const bus = road.hours * 1.25 + 0.5;
  out.push({
    mode: bus > 12 ? 'Bus' : 'Minivan',
    duration: fmtHours(bus),
    notes: `Estimate from ${src}, ~${km} km by road. Check real timetable.`,
    overnight: bus >= 9,
  });
  out.push({
    mode: 'Car / taxi',
    duration: fmtHours(road.hours * 1.05),
    notes: `Estimate from ${src}, ~${km} km.`,
    overnight: false,
  });
  if (straight >= 250) {
    const fly = straight / 700 + 0.5;
    out.push({
      mode: 'Flight',
      duration: fmtHours(fly),
      notes: `~${Math.round(straight / 10) * 10} km straight line. Add ~3h for airport and transfers. May need a connection.`,
      overnight: false,
    });
  }
  if (straight >= 60) {
    const train = (road.km * 1.1) / 55;
    out.push({
      mode: 'Train',
      duration: fmtHours(train),
      notes: 'Rough guess assuming a rail line exists. Many SE Asia routes have none, so verify.',
      overnight: train >= 9,
    });
  }
  return out;
}
