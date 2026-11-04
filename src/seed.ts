import { findCity } from './cities';
import type { Leg, Plan, Stop, TransportOption } from './types';

let n = 0;
const opt = (mode: string, duration: string, extra: Partial<TransportOption> = {}): TransportOption => ({
  id: `o${++n}`, mode, duration, cost: '', notes: '', overnight: false, extraDays: 0, ...extra,
});

export const seedPlan = (): Plan => {
  const t = 1;
  const stops: Record<string, Stop> = {};
  const legs: Record<string, Leg> = {};
  const stop = (id: string, name: string, nights: number, notes = ''): void => {
    const c = findCity(name);
    stops[id] = { id, name, lat: c?.[1] ?? null, lng: c?.[2] ?? null, nights, notes, days: [], activeOut: null, updatedAt: t };
  };
  const leg = (from: string, to: string, options: TransportOption[], chosen = 0) => {
    const id = `${from}-${to}`;
    legs[id] = { id, from, to, options, chosen: options[chosen]?.id ?? null, updatedAt: t };
  };

  stop('bkk1', 'Bangkok', 3);
  stop('cnx', 'Chiang Mai', 4);
  stop('lpb', 'Luang Prabang', 5, 'Fork: decide Laos route. Option A south via Vang Vieng/Vientiane, option B north via Nong Khiaw/Luang Namtha.');
  stop('vv', 'Vang Vieng', 3);
  stop('vte', 'Vientiane', 3);
  stop('nk', 'Nong Khiaw', 4);
  stop('lnt', 'Luang Namtha', 3);
  stop('kmg', 'Kunming', 4);
  stop('han', 'Hanoi', 5);
  stop('nb', 'Ninh Binh', 2);
  stop('hoi', 'Hoi An', 5);
  stop('sgn', 'Ho Chi Minh City', 5);
  stop('pnh', 'Phnom Penh', 3);
  stop('rep', 'Siem Reap', 4);
  stop('bkk2', 'Bangkok', 0, 'Final night before flying out / end of trip.');

  leg('bkk1', 'cnx', [
    opt('Flight', '1h 15m'),
    opt('Train', '12h', { overnight: true, notes: 'Sleeper train' }),
    opt('Bus', '10h', { overnight: true }),
  ], 0);
  leg('cnx', 'lpb', [
    opt('Flight', '1h 30m (via BKK/direct)'),
    opt('Slow boat', '2 days', { extraDays: 1, notes: 'Via Chiang Khong / Huay Xai, 1 night in Pakbeng' }),
    opt('Bus', '14h'),
  ], 1);
  leg('lpb', 'vv', [opt('Train', '2h'), opt('Minivan', '5-6h')]);
  leg('lpb', 'nk', [opt('Minivan', '3h')]);
  leg('vv', 'vte', [opt('Train', '1h'), opt('Bus', '3h')]);
  leg('nk', 'lnt', [opt('Minivan', '5-6h', { notes: 'Via Oudomxay' })]);
  leg('vte', 'kmg', [opt('Train', '~10h', { notes: 'Laos-China railway' }), opt('Flight', '2h 30m')]);
  leg('lnt', 'kmg', [opt('Bus', '8-10h', { notes: 'Via Boten/Mohan border' }), opt('Bus + train', '1 day')]);
  leg('kmg', 'han', [opt('Flight', '2h'), opt('Train', '1.5 days', { overnight: true, extraDays: 0 })]);
  leg('han', 'nb', [opt('Train', '2h'), opt('Bus', '2h')]);
  leg('nb', 'hoi', [opt('Train', '15h', { overnight: true, notes: 'To Da Nang then taxi' }), opt('Flight', '1h 20m (via Hanoi)')], 0);
  leg('hoi', 'sgn', [opt('Flight', '1h 30m from Da Nang'), opt('Sleeper bus', '16h', { overnight: true })]);
  leg('sgn', 'pnh', [opt('Bus', '6h'), opt('Boat', '5-6h (Mekong)')]);
  leg('pnh', 'rep', [opt('Bus', '6h'), opt('Flight', '1h')]);
  leg('rep', 'bkk2', [opt('Flight', '1h 10m'), opt('Bus', '9-10h')]);

  stops.lpb.activeOut = 'lpb-vv';

  return {
    v: 1,
    start: '2026-10-28',
    end: '2026-12-14',
    metaUpdatedAt: t,
    startId: 'bkk1',
    stops,
    legs,
  };
};
