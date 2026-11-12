import { clsx } from "clsx";

export const cn = (...args) => clsx(args);

export const oversOf = (balls = 0) => `${Math.floor((balls || 0) / 6)}.${(balls || 0) % 6}`;

export const scoreLine = (innings) =>
  innings ? `${innings.runs}/${innings.wickets}` : "—";

export const runRate = (runs = 0, balls = 0) => (balls ? ((runs / balls) * 6).toFixed(2) : "0.00");

export const requiredRate = (runs = 0, balls = 0) => (balls ? ((runs / balls) * 6).toFixed(2) : "0.00");

export const crr = runRate;
export const rrr = requiredRate;

export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export const formatNumber = (value = 0) => {
  const number = Number(value) || 0;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1)}K`;
  return `${number}`;
};

export const timeAgo = (date) => {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (abs < minute) return diff >= 0 ? "just now" : "in a moment";
  const suffix = diff >= 0 ? "ago" : "from now";
  if (abs < hour) return `${Math.floor(abs / minute)}m ${suffix}`;
  if (abs < day) return `${Math.floor(abs / hour)}h ${suffix}`;
  if (abs < day * 7) return `${Math.floor(abs / day)}d ${suffix}`;
  return new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export const formatDateTime = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export const formatTime = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

export const formatSeconds = (seconds = 0) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};

export const formatBytes = (bytes = 0) => {
  const value = Number(bytes) || 0;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${value} B`;
};

export const statusLabel = (status) => {
  switch (status) {
    case "live":
      return "LIVE";
    case "innings-break":
      return "INNINGS BREAK";
    case "finished":
      return "FINISHED";
    case "upcoming":
      return "UPCOMING";
    case "abandoned":
      return "ABANDONED";
    default:
      return String(status || "").toUpperCase();
  }
};

export const isLive = (match) => ["live", "innings-break"].includes(match?.status);

const ROLE_KEYS = {
  Batter: "batter",
  Bowler: "bowler",
  "All-Rounder": "allRounder",
  "Wicket-Keeper": "wicketKeeper",
};

/** Translate player roles while keeping unknown roles as-is. */
export const roleLabel = (role, t) => {
  if (!role) return "";
  const key = ROLE_KEYS[role];
  return key && t ? t(`role.${key}`) : role;
};

const BATTING_KEYS = {
  "Right-hand bat": "right",
  "Left-hand bat": "left",
};

const BOWLING_KEYS = {
  None: "none",
  "Right-arm fast": "rightFast",
  "Right-arm fast-medium": "rightFastMedium",
  "Right-arm medium": "rightMedium",
  "Right-arm offbreak": "rightOffbreak",
  "Right-arm legbreak": "rightLegbreak",
  "Left-arm fast": "leftFast",
  "Left-arm medium": "leftMedium",
  "Left-arm orthodox": "leftOrthodox",
  "Left-arm wrist-spin": "leftWristSpin",
};

/** Translate the enumerated batting/bowling styles from the backend. */
export const battingStyleLabel = (style, t) => {
  if (!style) return "";
  const key = BATTING_KEYS[style];
  return key && t ? t(`style.bat.${key}`) : style;
};

export const bowlingStyleLabel = (style, t) => {
  if (!style) return "";
  const key = BOWLING_KEYS[style];
  return key && t ? t(`style.bowl.${key}`) : style;
};

export const teamName = (team) => team?.shortName || team?.name || "TBC";

export const playerName = (player) => {
  if (!player) return "—";
  if (typeof player === "string") return "Player";
  return player.name || "Player";
};

export const scoreSummary = (match) => {
  if (!match) return { a: "", b: "" };
  const rows = match.innings || [];
  const a = rows.find((row) => String(row.battingTeam?._id || row.battingTeam) === String(match.teamA?._id || match.teamA));
  const b = rows.find((row) => String(row.battingTeam?._id || row.battingTeam) === String(match.teamB?._id || match.teamB));
  return {
    a: a ? `${a.runs}/${a.wickets}` : "",
    b: b ? `${b.runs}/${b.wickets}` : "",
    aInnings: a,
    bInnings: b,
  };
};

export const resultText = (match) => {
  if (!match) return "";
  if (match.result?.text) return match.result.text;
  if (match.status === "upcoming") return "Match yet to begin";
  return "";
};

export const sortedInnings = (match) => [...(match?.innings || [])].sort((x, y) => x.number - y.number);

export const currentInnings = (match) => match?.innings?.[match.currentInnings] || null;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const positionFromEvent = (event, ref, padding = 8) => {
  const rect = ref?.getBoundingClientRect();
  if (!rect) return { x: 24, y: 24 };
  return {
    x: clamp(event.clientX - rect.left, padding, rect.width - padding),
    y: clamp(event.clientY - rect.top, padding, rect.height - padding),
  };
};

export const readStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

export const wideFlag = (team) => team?.country?.flag?.url || team?.logo?.url || "";

/**
 * Clipboard with a synchronous fallback for browsers / iframes that block
 * the async Clipboard API. Resolves to true when the text was copied.
 */
export const copyText = async (value) => {
  const text = String(value ?? "");
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    if (ok) return true;
  } catch {
    // fall through to the manual prompt
  }
  // Last resort: let the user copy the text manually.
  try {
    window.prompt("Copy this link", text);
  } catch {
    // ignore
  }
  return false;
};

/**
 * Chase equation for a side batting second. Returns null when there is
 * nothing to chase (first innings, upcoming, finished, or no target).
 */
export const chaseInfo = (match) => {
  if (!match) return null;
  if (!["live", "innings-break"].includes(match.status)) return null;
  const index = Number.isInteger(match.currentInnings) ? match.currentInnings : (match.innings?.length || 1) - 1;
  const innings = match.innings?.[index];
  if (!innings || index < 1) return null;
  const target = innings.target || match.target || 0;
  if (!target) return null;
  const runsNeeded = Math.max(0, target - (innings.runs || 0));
  const ballsLeft = Math.max(0, (match.overs || 20) * 6 - (innings.balls || 0));
  const oversLeft = `${Math.floor(ballsLeft / 6)}.${ballsLeft % 6}`;
  if (runsNeeded === 0) {
    return {
      active: true,
      done: true,
      won: true,
      target,
      runsNeeded: 0,
      ballsLeft,
      oversLeft,
      requiredRate: "0.00",
      equation: "Target chased",
      text: "Target chased",
    };
  }
  if (ballsLeft === 0) {
    return {
      active: false,
      done: true,
      won: false,
      target,
      runsNeeded,
      ballsLeft,
      oversLeft,
      requiredRate: "0.00",
      equation: `${runsNeeded} short`,
      text: `Fell short by ${runsNeeded}`,
    };
  }
  const rate = ((runsNeeded / ballsLeft) * 6).toFixed(2);
  const equation = `${runsNeeded} run${runsNeeded === 1 ? "" : "s"} needed from ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}`;
  return {
    active: true,
    done: false,
    won: false,
    target,
    runsNeeded,
    ballsLeft,
    oversLeft,
    requiredRate: rate,
    equation,
    text: `${equation} · RRR ${rate}`,
  };
};

export const chaseText = (match) => chaseInfo(match)?.text || "";

export const matchViews = (match) =>
  Math.max(Number(match?.views || 0), Number(match?.stream?.totalViews || 0));

export const matchRank = (match) => {
  if (["live", "innings-break"].includes(match?.status)) return 0;
  if (match?.status === "upcoming") return 1;
  if (match?.status === "finished") return 2;
  return 3;
};

export const sortMatches = (rows = []) => {
  const time = (match) => new Date(match?.startTime || match?.createdAt || 0).getTime();
  return [...rows].sort((a, b) => {
    const rank = matchRank(a);
    if (rank !== matchRank(b)) return rank - matchRank(b);
    if (rank === 1) return time(a) - time(b);
    return time(b) - time(a);
  });
};
