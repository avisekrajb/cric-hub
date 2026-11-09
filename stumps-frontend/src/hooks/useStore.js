import { useState, useEffect, useCallback } from "react";
import { KEY } from "../constants/keys";
import { SEED } from "../constants/seed";

const load = () => {
  try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
  return SEED;
};

/* localStorage-backed store with cross-tab sync. upd(fn) mutates a cloned draft. */
export function useStore() {
  const [db, setDb] = useState(load);
  useEffect(() => {
    const f = (e) => { if (e.key === KEY && e.newValue) setDb(JSON.parse(e.newValue)); };
    window.addEventListener("storage", f);
    return () => window.removeEventListener("storage", f);
  }, []);
  const upd = useCallback((fn) => setDb((prev) => {
    const d = JSON.parse(JSON.stringify(prev)); fn(d);
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    return d;
  }), []);
  return [db, upd];
}
