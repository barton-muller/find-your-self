import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { get, migrateLegacy, set } from './storage';
import { applyEntry, diffEntry, sameTargets, type Entry } from './history';
import { now, uid } from './model';
import { todayStr } from './dates';
import { emptyPlan, uniquePath } from './trips';
import { planPts, prefetchOverview } from './tiles';
import { clearAuth, finishSignIn, freshAccess, loadAuth, startSignIn, type AuthState } from './auth';
import { seedPlan } from './seed';
import { configured, fetchRemote, mergePlans, samePlan, syncPlan } from './sync';
import type { Plan, SyncConfig, TripMeta, TripsState } from './types';

export type SyncState = { status: 'off' | 'idle' | 'syncing' | 'ok' | 'error'; at?: number; error?: string };

interface Ctx {
  plan: Plan;
  update: (fn: (draft: Plan) => void) => void;
  setMeta: (patch: Partial<Pick<Plan, 'start' | 'end'>>) => void;
  replacePlan: (p: Plan) => void;
  resetSeed: () => void;
  cfg: SyncConfig | null;
  saveCfg: (c: SyncConfig | null) => void;
  sync: SyncState;
  syncNow: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  trips: TripsState;
  activeTrip: TripMeta;
  switchTrip: (id: string) => Promise<void>;
  newTrip: (name: string) => Promise<void>;
  renameTrip: (id: string, name: string) => void;
  archiveTrip: (id: string) => Promise<void>;
  importTrip: (name: string, path: string) => Promise<string | null>;
  auth: AuthState | null;
  authError: string;
  signIn: () => void;
  signOut: () => Promise<void>;
  chooseRepo: (repo: string, branch: string) => void;
  effCfg: () => Promise<SyncConfig | null>;
}

const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

const OLD_PLAN_KEY = 'plan-v1';
const TRIPS_KEY = 'trips-v1';
const CFG_KEY = 'sync-cfg-v1';
const planKey = (id: string) => `plan:${id}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [cfg, setCfg] = useState<SyncConfig | null>(null);
  const [trips, setTrips] = useState<TripsState>({ active: 'main', list: [{ id: 'main', name: 'My trip' }] });
  const tripsRef = useRef<TripsState>(trips);
  const [sync, setSync] = useState<SyncState>({ status: 'off' });
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [authError, setAuthError] = useState('');
  const planRef = useRef<Plan | null>(null);
  const cfgRef = useRef<SyncConfig | null>(null);
  const busy = useRef(false);
  const undoStack = useRef<Entry[]>([]);
  const redoStack = useRef<Entry[]>([]);
  const [, setHv] = useState(0);
  const saveT = useRef<number>(0);
  const syncT = useRef<number>(0);

  planRef.current = plan;
  cfgRef.current = cfg;
  tripsRef.current = trips;

  const saveTrips = useCallback((t: TripsState) => {
    tripsRef.current = t;
    setTrips(t);
    set(TRIPS_KEY, t).catch(() => {});
  }, []);

  // The repo path of the active trip. Assigned on first use so renaming a trip never moves its file.
  const activePath = useCallback((): string => {
    const t = tripsRef.current;
    const cur = t.list.find((x) => x.id === t.active)!;
    if (cur.path) return cur.path;
    const path = uniquePath(cur.name, t.list);
    saveTrips({ ...t, list: t.list.map((x) => (x.id === cur.id ? { ...x, path } : x)) });
    return path;
  }, [saveTrips]);

  // the sync settings with a usable token: for a GitHub sign-in the access token is refreshed when it is about to expire
  const effCfg = useCallback(async (): Promise<SyncConfig | null> => {
    const c = cfgRef.current;
    if (!c) return null;
    if (!c.viaGitHub) return c;
    const t = await freshAccess();
    return t ? { ...c, token: t } : null;
  }, []);

  const runSync = useCallback(async () => {
    const base = cfgRef.current;
    const p = planRef.current;
    if (!configured(base) || !p || busy.current) return;
    busy.current = true;
    const tid = tripsRef.current.active;
    setSync((s) => ({ ...s, status: 'syncing' }));
    try {
      const c = await effCfg();
      if (!c) throw new Error('Signed out of GitHub. Sign in again in Settings.');
      const merged = await syncPlan({ ...c, path: activePath() }, p);
      if (tripsRef.current.active !== tid) {
        set(planKey(tid), merged).catch(() => {});
      } else if (!samePlan(merged, planRef.current!)) {
        const cur = planRef.current!;
        const final = mergePlans(cur, merged);
        planRef.current = final;
        setPlan(final);
        set(planKey(tid), final).catch(() => {});
      }
      setSync({ status: 'ok', at: Date.now() });
    } catch (e) {
      setSync({ status: 'error', error: e instanceof Error ? e.message : String(e), at: Date.now() });
    } finally {
      busy.current = false;
    }
  }, [activePath, effCfg]);

  useEffect(() => {
    (async () => {
      let tr: TripsState | undefined;
      let p: Plan | undefined;
      let c: SyncConfig | undefined;
      await migrateLegacy();
      try {
        c = await get<SyncConfig>(CFG_KEY);
        try {
          setAuth((await finishSignIn()) ?? (await loadAuth()));
        } catch (e) {
          setAuthError(e instanceof Error ? e.message : String(e));
          setAuth(await loadAuth());
        }
        tr = await get<TripsState>(TRIPS_KEY);
        if (!tr) {
          // first start with trips: the single plan of earlier versions becomes the first trip
          const legacy = await get<Plan>(OLD_PLAN_KEY);
          tr = { active: 'main', list: [{ id: 'main', name: legacy ? 'My trip' : 'Example trip', path: legacy && c?.path ? c.path : undefined }] };
          if (legacy) await set(planKey('main'), legacy);
          await set(TRIPS_KEY, tr);
          p = legacy;
        } else {
          p = await get<Plan>(planKey(tr.active));
        }
      } catch {
        /* storage unavailable */
      }
      const state: TripsState = tr ?? { active: 'main', list: [{ id: 'main', name: 'Example trip' }] };
      const initial = p ?? seedPlan();
      tripsRef.current = state;
      setTrips(state);
      planRef.current = initial;
      cfgRef.current = c ?? null;
      setPlan(initial);
      setCfg(c ?? null);
      if (configured(c ?? null)) {
        setSync({ status: 'idle' });
        runSync();
      }
      setTimeout(() => prefetchOverview(planPts(initial)).catch(() => {}), 4000);
    })();
    const onVis = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [runSync]);

  const persist = useCallback((p: Plan) => {
    window.clearTimeout(saveT.current);
    saveT.current = window.setTimeout(() => set(planKey(tripsRef.current.active), p).catch(() => {}), 300);
    if (configured(cfgRef.current)) {
      window.clearTimeout(syncT.current);
      syncT.current = window.setTimeout(runSync, 2500);
    }
  }, [runSync]);

  const replacePlan = useCallback((p: Plan) => {
    planRef.current = p;
    setPlan(p);
    persist(p);
  }, [persist]);

  const update = useCallback((fn: (d: Plan) => void) => {
    const prev = planRef.current!;
    const d = structuredClone(prev);
    fn(d);
    const e = diffEntry(prev, d);
    if (e) {
      const top = undoStack.current[undoStack.current.length - 1];
      if (top && e.t - top.t < 1200 && sameTargets(top, e)) top.t = e.t;
      else undoStack.current.push(e);
      if (undoStack.current.length > 80) undoStack.current.shift();
      redoStack.current = [];
      setHv((v) => v + 1);
    }
    replacePlan(d);
  }, [replacePlan]);

  const step = useCallback((from: Entry[], to: Entry[]) => {
    const e = from.pop();
    if (!e) return;
    const r = applyEntry(planRef.current!, e);
    to.push(r.inverse);
    setHv((v) => v + 1);
    replacePlan(r.plan);
  }, [replacePlan]);
  const undo = useCallback(() => step(undoStack.current, redoStack.current), [step]);
  const redo = useCallback(() => step(redoStack.current, undoStack.current), [step]);

  const setMeta = useCallback((patch: Partial<Pick<Plan, 'start' | 'end'>>) => {
    update((d) => {
      Object.assign(d, patch);
      d.metaUpdatedAt = now();
    });
  }, [update]);

  const resetSeed = useCallback(() => {
    const s = seedPlan();
    const t = now();
    s.metaUpdatedAt = t;
    Object.values(s.stops).forEach((x) => (x.updatedAt = t));
    Object.values(s.legs).forEach((x) => (x.updatedAt = t));
    // tombstone anything existing so a reset propagates through sync
    const cur = planRef.current;
    if (cur) {
      Object.values(cur.stops).forEach((x) => {
        if (!s.stops[x.id]) s.stops[x.id] = { ...x, deleted: true, updatedAt: t };
      });
      Object.values(cur.legs).forEach((x) => {
        if (!s.legs[x.id]) s.legs[x.id] = { ...x, deleted: true, updatedAt: t };
      });
    }
    replacePlan(s);
  }, [replacePlan]);

  const flush = useCallback(async () => {
    window.clearTimeout(saveT.current);
    window.clearTimeout(syncT.current);
    const p = planRef.current;
    if (p) await set(planKey(tripsRef.current.active), p).catch(() => {});
  }, []);

  const loadTrip = useCallback((next: Plan) => {
    undoStack.current = [];
    redoStack.current = [];
    planRef.current = next;
    setPlan(next);
    setHv((v) => v + 1);
    window.scrollTo(0, 0);
    setTimeout(() => prefetchOverview(planPts(next)).catch(() => {}), 2000);
    if (configured(cfgRef.current)) runSync();
  }, [runSync]);

  const switchTrip = useCallback(async (id: string) => {
    const cur = tripsRef.current;
    if (id === cur.active || !cur.list.some((t) => t.id === id)) return;
    await flush();
    const next = (await get<Plan>(planKey(id)).catch(() => undefined)) ?? emptyPlan(todayStr());
    saveTrips({ ...cur, active: id });
    loadTrip(next);
  }, [flush, saveTrips, loadTrip]);

  const newTrip = useCallback(async (name: string) => {
    await flush();
    const cur = tripsRef.current;
    const id = uid();
    const plan0 = emptyPlan(todayStr());
    await set(planKey(id), plan0).catch(() => {});
    saveTrips({ active: id, list: [...cur.list, { id, name: name.trim() || 'New trip' }] });
    loadTrip(plan0);
  }, [flush, saveTrips, loadTrip]);

  const renameTrip = useCallback((id: string, name: string) => {
    const cur = tripsRef.current;
    saveTrips({ ...cur, list: cur.list.map((t) => (t.id === id ? { ...t, name } : t)) });
  }, [saveTrips]);

  const archiveTrip = useCallback(async (id: string) => {
    const cur = tripsRef.current;
    const left = cur.list.filter((t) => t.id !== id && !t.archived);
    if (!left.length) return;
    const list = cur.list.map((t) => (t.id === id ? { ...t, archived: true } : t));
    if (cur.active === id) {
      await flush();
      const next = (await get<Plan>(planKey(left[0].id)).catch(() => undefined)) ?? emptyPlan(todayStr());
      saveTrips({ active: left[0].id, list });
      loadTrip(next);
    } else saveTrips({ ...cur, list });
  }, [flush, saveTrips, loadTrip]);

  const importTrip = useCallback(async (name: string, path: string): Promise<string | null> => {
    if (!configured(cfgRef.current)) return 'Connect a repository first.';
    try {
      const c = await effCfg();
      if (!c) return 'Signed out of GitHub. Sign in again in Settings.';
      const remote = await fetchRemote({ ...c, path });
      if (!remote) return `No plan.json found at ${path}.`;
      await flush();
      const cur = tripsRef.current;
      const id = uid();
      await set(planKey(id), remote.plan).catch(() => {});
      saveTrips({ active: id, list: [...cur.list, { id, name, path }] });
      loadTrip(remote.plan);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [flush, saveTrips, loadTrip, effCfg]);

  const saveCfg = useCallback((c: SyncConfig | null) => {
    cfgRef.current = c;
    setCfg(c);
    set(CFG_KEY, c).catch(() => {});
    if (configured(c)) {
      setSync({ status: 'idle' });
      runSync();
    } else setSync({ status: 'off' });
  }, [runSync]);

  const signOut = useCallback(async () => {
    await clearAuth();
    setAuth(null);
    if (cfgRef.current?.viaGitHub) saveCfg(null);
  }, [saveCfg]);

  const chooseRepo = useCallback((repo: string, branch: string) => {
    saveCfg({ repo, branch, path: 'plan.json', token: '', viaGitHub: true });
  }, [saveCfg]);

  const value = useMemo<Ctx | null>(
    () => plan && {
      plan, update, setMeta, replacePlan, resetSeed, cfg, saveCfg, sync, syncNow: runSync, undo, redo,
      trips, activeTrip: trips.list.find((t) => t.id === trips.active) ?? trips.list[0], switchTrip, newTrip, renameTrip, archiveTrip, importTrip,
      auth, authError, signIn: () => { void startSignIn(); }, signOut, chooseRepo, effCfg,
      canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, update, setMeta, replacePlan, resetSeed, cfg, saveCfg, sync, runSync, undo, redo, trips, switchTrip, newTrip, renameTrip, archiveTrip, importTrip, auth, authError, signOut, chooseRepo, effCfg, undoStack.current.length, redoStack.current.length],
  );
  if (!value) return <div className="boot">Loading…</div>;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
