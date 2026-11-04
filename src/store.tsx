import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { get, set } from 'idb-keyval';
import { applyEntry, diffEntry, sameTargets, type Entry } from './history';
import { now } from './model';
import { prefetchOverview } from './tiles';
import { seedPlan } from './seed';
import { configured, mergePlans, samePlan, syncPlan } from './sync';
import type { Plan, SyncConfig } from './types';

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
}

const StoreCtx = createContext<Ctx>(null as unknown as Ctx);
export const useStore = () => useContext(StoreCtx);

const PLAN_KEY = 'plan-v1';
const CFG_KEY = 'sync-cfg-v1';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [cfg, setCfg] = useState<SyncConfig | null>(null);
  const [sync, setSync] = useState<SyncState>({ status: 'off' });
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

  const runSync = useCallback(async () => {
    const c = cfgRef.current;
    const p = planRef.current;
    if (!configured(c) || !p || busy.current) return;
    busy.current = true;
    setSync((s) => ({ ...s, status: 'syncing' }));
    try {
      const merged = await syncPlan(c, p);
      if (!samePlan(merged, planRef.current!)) {
        const cur = planRef.current!;
        const final = mergePlans(cur, merged);
        planRef.current = final;
        setPlan(final);
        set(PLAN_KEY, final).catch(() => {});
      }
      setSync({ status: 'ok', at: Date.now() });
    } catch (e) {
      setSync({ status: 'error', error: e instanceof Error ? e.message : String(e), at: Date.now() });
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      let p: Plan | undefined;
      let c: SyncConfig | undefined;
      try {
        p = await get<Plan>(PLAN_KEY);
        c = await get<SyncConfig>(CFG_KEY);
      } catch {
        /* storage unavailable */
      }
      const initial = p ?? seedPlan();
      planRef.current = initial;
      cfgRef.current = c ?? null;
      setPlan(initial);
      setCfg(c ?? null);
      if (configured(c ?? null)) {
        setSync({ status: 'idle' });
        runSync();
      }
      setTimeout(() => prefetchOverview().catch(() => {}), 4000);
    })();
    const onVis = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [runSync]);

  const persist = useCallback((p: Plan) => {
    window.clearTimeout(saveT.current);
    saveT.current = window.setTimeout(() => set(PLAN_KEY, p).catch(() => {}), 300);
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

  const saveCfg = useCallback((c: SyncConfig | null) => {
    cfgRef.current = c;
    setCfg(c);
    set(CFG_KEY, c).catch(() => {});
    if (configured(c)) {
      setSync({ status: 'idle' });
      runSync();
    } else setSync({ status: 'off' });
  }, [runSync]);

  const value = useMemo<Ctx | null>(
    () => plan && {
      plan, update, setMeta, replacePlan, resetSeed, cfg, saveCfg, sync, syncNow: runSync, undo, redo,
      canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, update, setMeta, replacePlan, resetSeed, cfg, saveCfg, sync, runSync, undo, redo, undoStack.current.length, redoStack.current.length],
  );
  if (!value) return <div className="boot">Loading…</div>;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
