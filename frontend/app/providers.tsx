"use client";
import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from "react";
import { api } from "@/lib/api";

/* ---------------- theme (light / dark) + density (comfortable / compact) ---------------- */
const ThemeCtx = createContext<{ mode: string; toggle: () => void; density: string; toggleDensity: () => void }>({
  mode: "dark", toggle: () => {}, density: "comfortable", toggleDensity: () => {},
});
export const useTheme = () => useContext(ThemeCtx);

/* ---------------- refresh (manual + 60s poll tick) ---------------- */
const RefreshCtx = createContext<{ tick: number; refreshing: boolean; refreshNow: () => void; bump: () => void }>({
  tick: 0, refreshing: false, refreshNow: () => {}, bump: () => {},
});
export const useRefresh = () => useContext(RefreshCtx);

/* ---------------- priority filter (shared sidebar <-> feed) ---------------- */
const FilterCtx = createContext<{ urgency: string; setUrgency: (u: string) => void }>({
  urgency: "all", setUrgency: () => {},
});
export const useFilter = () => useContext(FilterCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [urgency, setUrgency] = useState("all");
  const [mode, setMode] = useState<string>("dark");
  const [density, setDensity] = useState<string>("comfortable");

  useEffect(() => {
    const initialMode = typeof document !== "undefined"
      ? document.documentElement.dataset.mode || "dark"
      : "dark";
    setMode(initialMode);

    try {
      const saved = localStorage.getItem("eii-density");
      const initialDensity = saved === "compact" ? "compact" : "comfortable";
      setDensity(initialDensity);
    } catch {
      setDensity("comfortable");
    }
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.mode = next;
      try { localStorage.setItem("eii-mode", next); } catch {}
      return next;
    });
  }, []);

  // view density (Edit view button): comfortable | compact
  useEffect(() => {
    document.documentElement.dataset.density = density;
    try { localStorage.setItem("eii-density", density); } catch {}
  }, [density]);
  const toggleDensity = useCallback(() => setDensity((d) => (d === "compact" ? "comfortable" : "compact")), []);

  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const bump = useCallback(() => setTick((t) => t + 1), []);  // refetch without running the pipeline
  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    try {
      await api("/api/refresh", { method: "POST" });
      await new Promise((r) => setTimeout(r, 2500)); // give the pipeline a head start
    } catch {}
    setTick((t) => t + 1);
    setRefreshing(false);
  }, []);

  return (
    <ThemeCtx.Provider value={{ mode, toggle, density, toggleDensity }}>
      <RefreshCtx.Provider value={{ tick, refreshing, refreshNow, bump }}>
        <FilterCtx.Provider value={{ urgency, setUrgency }}>{children}</FilterCtx.Provider>
      </RefreshCtx.Provider>
    </ThemeCtx.Provider>
  );
}

/* ---------------- data fetching: refetch on refresh tick + every 60s ---------------- */
export function useApi<T>(path: string | null): { data: T | null; error: boolean } {
  const { tick } = useRefresh();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () =>
      api<T>(path)
        .then((d) => { if (alive) { setData(d); setError(false); } })
        .catch(() => { if (alive) setError(true); });
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [path, tick]);
  return { data, error };
}

/* ---------------- checked-off to-dos, persisted on the device ---------------- */
export function useDone(): { done: Set<string>; toggle: (k: string) => void } {
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("eii-done-actions") || "[]");
      if (Array.isArray(saved)) setDone(new Set(saved));
    } catch {}
  }, []);
  const toggle = useCallback((k: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      try { localStorage.setItem("eii-done-actions", JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);
  return { done, toggle };
}
