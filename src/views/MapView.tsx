import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { fmtShortDate, addDays, diffDays, todayStr } from '../dates';
import { Icon } from '../icons';
import { TILE_URL } from '../tiles';
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
  const me = useRef<L.LayerGroup | null>(null);
  const s = useMemo(() => schedule(plan), [plan]);
  const ci = useMemo(() => colorIndex(plan, s), [plan, s]);
  const today = diffDays(plan.start, todayStr());
  const nowId = s.path.find((id) => s.arrive[id] <= today && today <= s.arrive[id] + plan.stops[id].nights);

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true, attributionControl: true }).setView([15, 103], 5);
    L.tileLayer(TILE_URL, {
      maxZoom: 18,
      crossOrigin: true,
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
      const html = `<div class="pin ${idx >= 0 ? 'on' : 'alt'}${x.id === nowId ? ' now' : ''}" style="background:var(--c${ci[x.id]})">${idx >= 0 ? idx + 1 : '·'}</div>`;
      const mk = L.marker(p, { icon: L.divIcon({ html, className: '', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(g);
      const d = s.arrive[x.id] !== undefined ? `${fmtShortDate(addDays(plan.start, s.arrive[x.id]))} · ` : '';
      mk.bindTooltip(idx >= 0 ? x.name : `${x.name} (${d}${x.nights}n)`, { permanent: idx >= 0, direction: 'right', offset: [10, 0], className: 'maplabel' });
      mk.on('click', () => go({ view: 'place', id: x.id }));
    }
    if (!fitted.current && pts.length) {
      m.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });
      fitted.current = true;
    }
  }, [plan, s, ci, nowId]);

  const locate = () => {
    const m = map.current;
    if (!m) return;
    if (!navigator.geolocation) return alert('Location not available');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        me.current?.remove();
        const ll: L.LatLngTuple = [pos.coords.latitude, pos.coords.longitude];
        me.current = L.layerGroup([
          L.circle(ll, { radius: pos.coords.accuracy, color: '#205EA6', weight: 1, fillOpacity: 0.12 }),
          L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#205EA6', fillOpacity: 1 }),
        ]).addTo(m);
        m.setView(ll, Math.max(m.getZoom(), 9));
      },
      () => alert('Could not get your location'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const missing = liveStops(plan).filter((x) => x.lat === null);
  return (
    <div className="mapwrap">
      <div ref={el} className="map" />
      <button className="locate" aria-label="my location" onClick={locate}><Icon name="locate" size={22} /></button>
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
