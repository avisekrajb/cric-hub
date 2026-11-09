import { useEffect } from "react";
import { api } from "../lib/api";

const STORAGE_KEY = "bethub_viewed_matches";

const readViewed = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

/**
 * Registers a view exactly once per browser session for a match page.
 * Live pages poll every few seconds, so this has to be idempotent.
 */
export function useMatchView(match) {
  const id = match?._id ? String(match._id) : "";

  useEffect(() => {
    if (!id) return;
    const viewed = readViewed();
    if (viewed[id]) return;
    viewed[id] = Date.now();
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(viewed));
    } catch {
      // private mode — still allow the counter call below
    }
    api(`/api/matches/${id}/view`, { method: "POST", auth: false }).catch(() => {});
  }, [id]);
}

export default useMatchView;
