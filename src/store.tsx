import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { get, set } from 'idb-keyval';
import { now } from './model';
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
    const d = structuredClone(planRef.current!);
    fn(d);
    replacePlan(d);
  }, [replacePlan]);

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
    () => plan && { plan, update, setMeta, replacePlan, resetSeed, cfg, saveCfg, sync, syncNow: runSync },
    [plan, update, setMeta, replacePlan, resetSeed, cfg, saveCfg, sync, runSync],
  );
  if (!value) return <div className="boot">Loading…</div>;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
