import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { fmtShortDate, addDays } from '../dates';
import { chosenOption, colorIndex, liveLegs, liveStops, schedule } from '../model';
import { go } from '../nav';
import { useStore } from '../store';
import { iconSvgString } from '../icons';
import { modeIcon } from '../ui';

export function MapView() {
  const { plan } = useStore();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const s = useMemo(() => schedule(plan), [plan]);
  const ci = useMemo(() => colorIndex(plan, s), [plan, s]);

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true, attributionControl: true }).setView([15, 103], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => {
      m.remove();
      map.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngTuple[] = [];
    const stops = liveStops(plan);
    const at = (id: string): L.LatLngTuple | null => {
      const x = plan.stops[id];
      return x.lat === null || x.lng === null ? null : [x.lat, x.lng];
    };
    for (const l of liveLegs(plan)) {
      const a = at(l.from);
      const b = at(l.to);
      if (!a || !b) continue;
      const active = s.activeLegs.has(l.id);
      const o = chosenOption(l);
      const line = L.polyline([a, b], {
        className: `lc${ci[l.from]}`,
        weight: active ? 5 : 3,
        dashArray: active ? undefined : '6 8',
        opacity: active ? 0.95 : 0.6,
      }).addTo(g);
      if (o) line.bindTooltip(`${iconSvgString(modeIcon(o.mode))} ${o.mode}${o.duration ? ' · ' + o.duration : ''}${o.overnight ? ' ' + iconSvgString('moon') : ''}`, { sticky: true });
    }
    for (const x of stops) {
      const p = at(x.id);
      if (!p) continue;
      pts.push(p);
      const idx = s.path.indexOf(x.id);
      const html = `<div class="pin ${idx >= 0 ? 'on' : 'alt'}" style="background:var(--c${ci[x.id]})">${idx >= 0 ? idx + 1 : '·'}</div>`;
      const mk = L.marker(p, { icon: L.divIcon({ html, className: '', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(g);
      const d = s.arrive[x.id] !== undefined ? `${fmtShortDate(addDays(plan.start, s.arrive[x.id]))} · ` : '';
      mk.bindTooltip(idx >= 0 ? x.name : `${x.name} (${d}${x.nights}n)`, { permanent: idx >= 0, direction: 'right', offset: [10, 0], className: 'maplabel' });
      mk.on('click', () => go({ view: 'place', id: x.id }));
    }
    if (!fitted.current && pts.length) {
      m.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
      fitted.current = true;
    }
  }, [plan, s, ci]);

  const missing = liveStops(plan).filter((x) => x.lat === null);
  return (
    <div className="mapwrap">
      <div ref={el} className="map" />
      {missing.length > 0 && (
        <div className="maphint">
          No coordinates: {missing.map((x, i) => (
            <a key={x.id} href={`#/place/${x.id}`}>{i ? ', ' : ''}{x.name || 'Unnamed'}</a>
          ))}
        </div>
      )}
    </div>
  );
}
