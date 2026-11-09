import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export function useFetch(path, { enabled = true, deps = [], poll = 0 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(path) && enabled);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (silent = false) => {
      if (!path || !enabled) {
        setLoading(false);
        return null;
      }
      const id = ++requestRef.current;
      if (!silent) setLoading(true);
      setError("");
      try {
        const result = await api(path);
        if (mountedRef.current && id === requestRef.current) setData(result);
        return result;
      } catch (err) {
        if (mountedRef.current && id === requestRef.current) setError(err.message || "Something went wrong");
        return null;
      } finally {
        if (mountedRef.current && id === requestRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, enabled]
  );

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  useEffect(() => {
    if (!poll || !path || !enabled) return undefined;
    const timer = setInterval(() => run(true), poll);
    return () => clearInterval(timer);
  }, [poll, path, enabled, run]);

  return { data, loading, error, refetch: run, setData };
}
