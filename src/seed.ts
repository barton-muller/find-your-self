import { findCity } from './cities';
import { addDays, todayStr } from './dates';
import type { Leg, Plan, Stop, Todo, TransportOption } from './types';

let n = 0;
const opt = (mode: string, duration: string, extra: Partial<TransportOption> = {}): TransportOption => ({
  id: `o${++n}`, mode, duration, cost: '', notes: '', overnight: false, extraDays: 0, ...extra,
});

export const seedPlan = (): Plan => {
  const t = 1;
  const start = addDays(todayStr(), 3);
  const stops: Record<string, Stop> = {};
  const legs: Record<string, Leg> = {};
  const todos: Record<string, Todo> = {};
  const stop = (id: string, name: string, nights: number, extra: Partial<Stop> = {}): void => {
    const c = findCity(name);
    stops[id] = {
      id, name, lat: c?.[1] ?? null, lng: c?.[2] ?? null, country: c?.[3], nights, notes: '', days: [], activeOut: null, updatedAt: t, ...extra,
    };
  };
  const leg = (from: string, to: string, options: TransportOption[], chosen = 0) => {
    const id = `${from}-${to}`;
    legs[id] = { id, from, to, options, chosen: options[chosen]?.id ?? null, updatedAt: t };
  };

  stop('bkk', 'Bangkok', 2, {
    notes: 'Example trip. Tap any stop to edit it, or reset it in Settings.',
    accom: 'Guesthouse near the river', accomBooked: true,
    days: ['Arrive, street food in Chinatown', 'Grand Palace early, river boat in the afternoon'],
  });
  stop('cnx', 'Chiang Mai', 3, {
    notes: 'Old city is walkable. Rent a scooter only if you have a licence.',
    days: ['Temples in the old city, night market', 'Doi Suthep at sunrise', 'Cooking class'],
  });
  stop('cri', 'Chiang Rai', 2, { days: ['White Temple', 'Hill tribe village by songthaew'] });
  stop('lpb', 'Luang Prabang', 3, {
    notes: 'Fork: pick the route after here. The slow boat arrives in the afternoon.',
    days: ['Alms giving at dawn, night market', 'Kuang Si waterfalls', ''],
  });
  stop('vv', 'Vang Vieng', 2, { days: ['Tubing', 'Viewpoint hike and blue lagoon'] });
  stop('nk', 'Nong Khiaw', 2, { notes: 'Quiet river town. Boat to Muang Ngoi for a day.' });
  stop('vte', 'Vientiane', 2, { notes: 'Last stop. Fly home from here.' });

  leg('bkk', 'cnx', [
    opt('Sleeper train', '12h', { overnight: true, booked: true, notes: 'Lower berth, second class' }),
    opt('Flight', '1h 15m'),
  ], 0);
  leg('cnx', 'cri', [opt('Bus', '3h 30m'), opt('Minivan', '3h')], 0);
  leg('cri', 'lpb', [
    opt('Slow boat', '2 days', { extraDays: 1, notes: 'Bus to Huay Xai, one night in Pak Beng' }),
    opt('Bus', '12h'),
  ], 0);
  leg('lpb', 'vv', [opt('Train', '1h 45m'), opt('Minivan', '5h')], 0);
  leg('lpb', 'nk', [opt('Minivan', '3h')], 0);
  leg('vv', 'vte', [opt('Train', '1h'), opt('Bus', '3h')], 0);
  leg('nk', 'vte', [opt('Sleeper bus', '11h', { overnight: true })], 0);
  stops.lpb.activeOut = 'lpb-vv';

  const todo = (id: string, text: string, due: string | null, done = false) => {
    todos[id] = { id, text, done, due, updatedAt: t };
  };
  todo('t1', 'Buy travel insurance', addDays(start, -1));
  todo('t2', 'Download offline maps', addDays(start, -1), true);
  todo('t3', 'Check visa rules for Laos', addDays(start, 4));

  return { v: 1, start, end: addDays(start, 15), metaUpdatedAt: t, startId: 'bkk', stops, legs, todos };
};
