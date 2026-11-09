import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../lib/api";

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem("bethub_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? readStoredUser() : null));
  const [token, setTokenState] = useState(() => getToken());
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken("");
    setTokenState("");
    setUser(null);
    try {
      localStorage.removeItem("bethub_user");
    } catch {
      /* ignore */
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api("/api/auth/login", { method: "POST", body: { email, password }, auth: false });
    setToken(data.token);
    setTokenState(data.token);
    setUser(data.user);
    try {
      localStorage.setItem("bethub_user", JSON.stringify(data.user));
    } catch {
      /* ignore */
    }
    return data.user;
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await api("/api/auth/me");
      setUser(data.user);
      try {
        localStorage.setItem("bethub_user", JSON.stringify(data.user));
      } catch {
        /* ignore */
      }
      return data.user;
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) logout();
      return null;
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, refresh, isAdmin: user?.role === "admin" }),
    [user, token, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
