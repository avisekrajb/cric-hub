import { useState } from "react";
import { ADMIN_SESSION_KEY } from "../constants/keys";

export function useAdminSession() {
  const [admin, setAdmin] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1"; } catch (e) { return false; }
  });
  const setFlag = (on) => {
    setAdmin(on);
    try { on ? sessionStorage.setItem(ADMIN_SESSION_KEY, "1") : sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch (e) {}
  };
  return [admin, setFlag];
}
