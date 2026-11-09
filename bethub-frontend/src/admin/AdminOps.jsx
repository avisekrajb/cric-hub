import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  Clock,
  Download,
  Eye,
  Flag,
  Gauge,
  Loader2,
  Megaphone,
  MessageSquare,
  Pin,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Tv,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { AdminPage, Field, Panel, StatCard, StatusDot } from "./components/AdminUI";
import { TeamLogo } from "../components/common/Avatars";
import { PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useSocketEvent } from "../contexts/SocketContext";
import { useToast } from "../contexts/ToastContext";
import { api, API_ORIGIN, getToken } from "../lib/api";
import { cn, formatDateTime, formatNumber, formatSeconds, timeAgo } from "../lib/utils";

const PRIORITIES = [
  { key: "urgent", label: "Urgent", className: "border-coral/30 bg-coral/10 text-coral" },
  { key: "high", label: "High", className: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  { key: "normal", label: "Normal", className: "border-sky/30 bg-sky/10 text-sky" },
  { key: "low", label: "Low", className: "border-white/15 bg-white/[0.04] text-white/45" },
];

const COLUMNS = [
  { key: "todo", label: "To do", accent: "text-white/45" },
  { key: "doing", label: "In progress", accent: "text-amber-300" },
  { key: "done", label: "Done", accent: "text-mint" },
];

const AUDIT_CATEGORIES = ["all", "match", "stream", "chat", "task", "flag", "announcement", "export", "auth"];
const EXPORTS = [
  { type: "matches", label: "Matches" },
  { type: "players", label: "Players" },
  { type: "teams", label: "Teams" },
  { type: "countries", label: "Countries" },
  { type: "tasks", label: "Tasks" },
  { type: "audit", label: "Audit log" },
];

const priorityMeta = (key) => PRIORITIES.find((row) => row.key === key) || PRIORITIES[2];

const matchLabel = (match) => `${match?.teamA?.shortName || "TBC"} vs ${match?.teamB?.shortName || "TBC"}`;

const countdown = (date, now) => {
  if (!date) return "TBC";
  const diff = new Date(date).getTime() - now;
  if (Number.isNaN(diff)) return "TBC";
  if (diff <= 0) return "Starting now";
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

const alertTone = {
  critical: "border-coral/25 bg-coral/[0.07] text-coral",
  warning: "border-amber-400/25 bg-amber-400/[0.07] text-amber-300",
  info: "border-sky/25 bg-sky/[0.07] text-sky",
};

function Pill({ children, className = "" }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", className)}>{children}</span>;
}

function Sparkline({ values }) {
  const rows = values.length ? values.slice(-24) : [0];
  const max = Math.max(...rows, 1);
  return (
    <div className="flex h-10 items-end gap-[3px]">
      {rows.map((value, index) => (
        <span
          key={`${index}-${value}`}
          className={cn("flex-1 rounded-sm transition-all", index === rows.length - 1 ? "bg-lime" : "bg-lime/30")}
          style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function TaskCard({ task, onMove, onDelete, busy, now }) {
  const priority = priorityMeta(task.priority);
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-white/85">{task.title}</p>
        <button type="button" onClick={() => onDelete(task)} className="rounded p-1 text-white/20 transition hover:bg-coral/10 hover:text-coral" aria-label="Delete task">
          <Trash2 size={11} />
        </button>
      </div>
      {task.description && <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-white/35">{task.description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Pill className={priority.className}>{priority.label}</Pill>
        {task.assignedTo && <span className="text-[9px] text-white/35">{task.assignedTo}</span>}
        {task.match && <span className="text-[9px] text-white/30">· {matchLabel(task.match)}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
        <span className="inline-flex items-center gap-1 text-[9px] text-white/25">
          <Clock size={9} /> {task.dueAt ? countdown(task.dueAt, now) : timeAgo(task.createdAt)}
        </span>
        <div className="flex gap-1">
          {COLUMNS.filter((row) => row.key !== task.status).map((row) => (
            <button
              key={row.key}
              type="button"
              disabled={busy === task._id}
              onClick={() => onMove(task, row.key)}
              className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white/35 transition hover:border-lime/30 hover:text-lime disabled:opacity-40"
            >
              {row.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminOps() {
  const { data, loading, error, refetch } = useFetch("/api/ops/overview", { poll: 20000 });
  const { success: toastSuccess, error: toastError } = useToast();

  const [pulse, setPulse] = useState(null);
  const [history, setHistory] = useState([]);
  const [admins, setAdmins] = useState(null);
  const [liveAudit, setLiveAudit] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [flags, setFlags] = useState([]);
  const [chat, setChat] = useState([]);
  const [busy, setBusy] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [auditFilter, setAuditFilter] = useState("all");
  const [auditQuery, setAuditQuery] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "normal", assignedTo: "", dueAt: "", matchId: "" });
  const [announceForm, setAnnounceForm] = useState({ title: "", body: "", type: "announcement", matchId: "" });
  const [now, setNow] = useState(() => Date.now());

  const counts = data?.counts || {};
  const live = data?.live || [];
  const upcoming = data?.upcoming || [];
  const livekit = data?.livekit || {};
  const health = data?.health || {};
  const limits = data?.limits || {};

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data?.tasks) setTasks(data.tasks);
    if (data?.flags) setFlags(data.flags);
    if (data?.chat) setChat(data.chat);
  }, [data?.tasks, data?.flags, data?.chat]);

  useSocketEvent("ops:pulse", (payload) => {
    if (!payload) return;
    setPulse(payload);
    setHistory((rows) => [...rows, Number(payload.viewers) || 0].slice(-24));
  });

  useSocketEvent("admin:presence", (payload) => {
    if (!payload) return;
    if (Array.isArray(payload.admins)) setAdmins(payload.admins);
  });

  useSocketEvent("ops:audit", (log) => {
    if (!log?._id) return;
    setLiveAudit((rows) => [log, ...rows].slice(0, 50));
  });

  useSocketEvent("ops:task", ({ type, task } = {}) => {
    if (!task) return;
    if (type === "deleted") {
      setTasks((rows) => rows.filter((row) => row._id !== task._id));
      return;
    }
    setTasks((rows) => {
      const exists = rows.some((row) => row._id === task._id);
      return exists ? rows.map((row) => (row._id === task._id ? task : row)) : [task, ...rows];
    });
  });

  useSocketEvent("ops:flag", (flag) => {
    if (!flag?.key) return;
    setFlags((rows) => rows.map((row) => (row.key === flag.key ? flag : row)));
  });

  useSocketEvent("ops:chat", () => {
    refetch(true);
  });

  useSocketEvent("stream:update", () => {
    refetch(true);
  });

  const run = async (key, action, message) => {
    setBusy(key);
    try {
      const result = await action();
      if (message) toastSuccess(message);
      await refetch(true);
      return result;
    } catch (err) {
      toastError(err.message || "That action failed");
      return null;
    } finally {
      setBusy("");
    }
  };

  const selectedMatches = useMemo(() => live.filter((match) => selectedIds.includes(match._id)), [live, selectedIds]);

  const allLiveSelected = live.length > 0 && selectedMatches.length === live.length;

  const toggleSelect = (id) => {
    setSelectedIds((rows) => (rows.includes(id) ? rows.filter((row) => row !== id) : [...rows, id]));
  };

  const toggleAll = () => {
    setSelectedIds(allLiveSelected ? [] : live.map((match) => match._id));
  };

  const matchAction = (match, action, label) =>
    run(`match-${match._id}-${action}`, () => api(`/api/ops/matches/${match._id}/action`, { method: "POST", body: { action } }), label);

  const bulkAction = (action) =>
    run(`bulk-${action}`, async () => {
      const result = await api("/api/ops/matches/bulk", { method: "POST", body: { action, ids: selectedIds } });
      setSelectedIds([]);
      return result;
    }, `Bulk ${action} applied`);

  const moveTask = (task, status) =>
    run(task._id, () => api(`/api/ops/tasks/${task._id}`, { method: "PATCH", body: { status } }), `Task moved to ${status}`);

  const deleteTask = (task) =>
    run(`delete-${task._id}`, () => api(`/api/ops/tasks/${task._id}`, { method: "DELETE" }), "Task deleted");

  const createTask = (event) => {
    event.preventDefault();
    if (!taskForm.title.trim()) return;
    run("task-create", async () => {
      const created = await api("/api/ops/tasks", { method: "POST", body: taskForm });
      setTaskForm({ title: "", description: "", priority: "normal", assignedTo: "", dueAt: "", matchId: "" });
      return created;
    }, "Ops task created");
  };

  const toggleFlag = (flag) =>
    run(`flag-${flag.key}`, () => api(`/api/ops/flags/${flag.key}`, { method: "PATCH", body: { enabled: !flag.enabled } }), `${flag.label} ${flag.enabled ? "disabled" : "enabled"}`);

  const moderate = (message, patch) =>
    run(`chat-${message._id}`, async () => {
      const result = await api(`/api/ops/chat/${message._id}`, { method: "PATCH", body: patch });
      setChat((rows) => rows.map((row) => (row._id === message._id ? { ...row, ...result.message } : row)));
      return result;
    }, "Chat message updated");

  const removeMessage = (message) =>
    run(`chat-del-${message._id}`, async () => {
      await api(`/api/ops/chat/${message._id}`, { method: "DELETE" });
      setChat((rows) => rows.filter((row) => row._id !== message._id));
    }, "Chat message deleted");

  const sendAnnouncement = (event) => {
    event.preventDefault();
    if (!announceForm.title.trim() || !announceForm.body.trim()) return;
    run("announce", async () => {
      const result = await api("/api/ops/announce", { method: "POST", body: announceForm });
      setAnnounceForm({ title: "", body: "", type: "announcement", matchId: "" });
      return result;
    }, "Announcement sent to every fan");
  };

  const downloadCsv = async (type) => {
    setBusy(`export-${type}`);
    try {
      const token = getToken();
      const response = await fetch(`${API_ORIGIN}/api/ops/export?type=${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Export failed — check your admin session");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bethub-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toastSuccess(`${type} CSV downloaded`);
    } catch (err) {
      toastError(err.message || "Export failed");
    } finally {
      setBusy("");
    }
  };

  const auditRows = useMemo(() => {
    const seen = new Set();
    const rows = [...liveAudit, ...(data?.audit || [])].filter((log) => {
      if (!log?._id || seen.has(log._id)) return false;
      seen.add(log._id);
      return true;
    });
    return rows
      .filter((log) => auditFilter === "all" || log.category === auditFilter)
      .filter((log) => {
        if (!auditQuery.trim()) return true;
        const q = auditQuery.toLowerCase();
        return `${log.summary} ${log.action} ${log.actor?.name || ""}`.toLowerCase().includes(q);
      })
      .slice(0, 60);
  }, [liveAudit, data?.audit, auditFilter, auditQuery]);

  const chatRows = useMemo(() => {
    if (!chatQuery.trim()) return chat;
    const q = chatQuery.toLowerCase();
    return chat.filter((row) => `${row.user} ${row.body}`.toLowerCase().includes(q));
  }, [chat, chatQuery]);

  const presenceRows = admins || data?.admins || [];
  const onlineAdmins = pulse?.onlineAdmins ?? presenceRows.length;
  const viewers = pulse?.viewers ?? counts.viewers ?? 0;
  const liveStreams = pulse?.liveStreams ?? counts.liveStreams ?? 0;
  const recordings = pulse?.recordings ?? counts.recordings ?? 0;
  const liveMatches = pulse?.liveMatches ?? counts.liveMatches ?? 0;

  if (loading && !data) return <PageLoader label="Opening the realtime ops centre…" />;

  if (error && !data) {
    return (
      <AdminPage eyebrow="Realtime ops" title="Control room unavailable" subtitle={error}>
        <button type="button" onClick={() => refetch()} className="btn-primary btn-xs"><RefreshCw size={12} /> Retry</button>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      eyebrow="Realtime ops"
      title="Operations control room"
      subtitle="Twenty live controls for matchday: presence, tasks, stream floors, moderation, flags, health and exports — all pushed over sockets."
      actions={
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/20 bg-lime/[0.06] px-2.5 py-1 text-[10px] font-semibold text-lime">
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime" /> live socket feed
          </span>
          <button type="button" onClick={() => refetch(true)} className="btn-ghost btn-xs" disabled={busy === "refresh"}>
            <RefreshCw size={12} className={cn(busy === "refresh" && "animate-spin")} /> Refresh
          </button>
        </>
      }
    >
      {/* 1 · realtime KPI pulse + 2 · viewer sparkline */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Radio} label="Live matches" value={formatNumber(liveMatches)} hint={`${limits.maxLiveMatches || 10} slots`} accent="text-coral" />
        <StatCard icon={Tv} label="Stream floors" value={formatNumber(liveStreams)} hint={`${recordings} recording`} accent="text-lime" />
        <StatCard icon={Eye} label="Fans watching" value={formatNumber(viewers)} hint="socket pulse" accent="text-sky" />
        <StatCard icon={ClipboardList} label="Open tasks" value={formatNumber(counts.openTasks || 0)} hint={`${counts.urgentTasks || 0} urgent`} accent="text-amber-300" />
        <StatCard icon={Users} label="Admins online" value={formatNumber(onlineAdmins)} hint="control room seats" accent="text-mint" />
        <StatCard icon={MessageSquare} label="Chat messages" value={formatNumber(counts.chatMessages || 0)} hint="visible to fans" accent="text-white/70" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Ops pulse" subtitle="Viewers across every live floor · refreshed over sockets" action={<span className="text-[10px] text-white/25">{pulse?.at ? `updated ${timeAgo(pulse.at)}` : "waiting for pulse"}</span>}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-display text-3xl font-700 tabular-nums text-white">{formatNumber(viewers)}</p>
              <p className="mt-0.5 text-[10px] text-white/35">concurrent fans right now</p>
            </div>
            <Sparkline values={history.length ? history : Array.from({ length: 12 }, () => viewers)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-4">
            {[
              { label: "Pulse", value: pulse ? "live" : "polling", tone: pulse ? "text-lime" : "text-white/40" },
              { label: "Streams", value: `${liveStreams} on air`, tone: "text-coral" },
              { label: "Recordings", value: `${recordings}/${limits.maxRecordings || 5}`, tone: "text-mint" },
              { label: "Live window", value: `${limits.maxLiveHours ?? 4}h`, tone: "text-amber-300" },
            ].map((row) => (
              <div key={row.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                <p className="text-[8px] font-bold uppercase tracking-wider text-white/25">{row.label}</p>
                <p className={cn("mt-0.5 text-[11px] font-semibold", row.tone)}>{row.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Admin presence" subtitle="Who is in the control room and where" bodyClassName="space-y-2">
          {presenceRows.length ? presenceRows.slice(0, 6).map((row) => (
            <div key={row.socketId || row.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-lime text-[10px] font-bold text-ink-950">{(row.name || "A").slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-white/80">{row.name}</p>
                <p className="truncate text-[9px] text-white/30">{row.page || row.email || "control room"}</p>
              </div>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
            </div>
          )) : (
            <p className="py-6 text-center text-[11px] text-white/30">Only you are online right now.</p>
          )}
          <p className="border-t border-white/[0.06] pt-2 text-[9px] text-white/25">Presence updates instantly on login, navigation and disconnect.</p>
        </Panel>
      </div>

      {/* 3 · smart alerts */}
      <Panel title="Smart alerts" subtitle="Server-computed risks across live, streams, flags and health" bodyClassName="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(data?.alerts || []).length ? data.alerts.map((alert) => (
          <div key={alert.id} className={cn("rounded-xl border px-3 py-2.5", alertTone[alert.level] || alertTone.info)}>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold"><AlertTriangle size={12} /> {alert.title}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-white/45">{alert.text}</p>
          </div>
        )) : (
          <p className="inline-flex items-center gap-2 text-[11px] text-mint"><ShieldCheck size={14} /> Everything looks healthy. No alerts.</p>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        {/* 4 · live match quick actions + 5 · bulk actions */}
        <Panel
          title="Live match commands"
          subtitle="Start, finish, feature or end streams without leaving the room"
          action={
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={toggleAll} className="btn-ghost btn-xs">{allLiveSelected ? "Clear" : "Select all"}</button>
              <button type="button" disabled={!selectedIds.length || Boolean(busy)} onClick={() => bulkAction("feature")} className="btn-ghost btn-xs">Feature</button>
              <button type="button" disabled={!selectedIds.length || Boolean(busy)} onClick={() => bulkAction("unfeature")} className="btn-ghost btn-xs">Unfeature</button>
              <button type="button" disabled={!selectedIds.length || Boolean(busy)} onClick={() => bulkAction("finish")} className="btn-ghost btn-xs">Finish</button>
              <button type="button" disabled={!selectedIds.length || Boolean(busy)} onClick={() => bulkAction("end-stream")} className="btn-danger btn-xs">End streams</button>
            </div>
          }
          bodyClassName="!p-0"
        >
          {live.length ? live.map((match) => (
            <div key={match._id} className="flex flex-wrap items-center gap-2.5 border-b border-white/[0.05] px-3 py-2.5 last:border-0">
              <input type="checkbox" checked={selectedIds.includes(match._id)} onChange={() => toggleSelect(match._id)} className="h-3.5 w-3.5 accent-lime" aria-label={`Select ${matchLabel(match)}`} />
              <div className="flex shrink-0 -space-x-1.5"><TeamLogo team={match.teamA} size="xs" /><TeamLogo team={match.teamB} size="xs" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-white/85">{matchLabel(match)}</p>
                <p className="truncate text-[9px] text-white/30">
                  {match.series} · {match.status}
                  {match.stream?.isLive ? ` · ${match.stream.mode || "live"} · ${formatNumber(match.stream.viewers || 0)} viewers` : ""}
                </p>
              </div>
              {match.isFeatured && <Pill className="border-lime/25 bg-lime/[0.08] text-lime">featured</Pill>}
              <div className="flex shrink-0 flex-wrap gap-1">
                {match.status === "upcoming" && (
                  <button type="button" onClick={() => matchAction(match, "start", `${matchLabel(match)} started`)} disabled={Boolean(busy)} className="btn-primary btn-xs"><Play size={10} /> Start</button>
                )}
                <button type="button" onClick={() => matchAction(match, "finish", `${matchLabel(match)} finished`)} disabled={Boolean(busy)} className="btn-ghost btn-xs"><Square size={10} /> Finish</button>
                <button type="button" onClick={() => matchAction(match, match.isFeatured ? "unfeature" : "feature", "Featured updated")} disabled={Boolean(busy)} className="btn-ghost btn-xs"><Sparkles size={10} /></button>
                {match.stream?.isLive && (
                  <button type="button" onClick={() => matchAction(match, "end-stream", "Stream ended")} disabled={Boolean(busy)} className="btn-danger btn-xs"><WifiOff size={10} /></button>
                )}
                <Link to={`/admin/matches/${match._id}/score`} className="btn-ghost btn-xs">Score</Link>
              </div>
            </div>
          )) : (
            <p className="px-4 py-10 text-center text-xs text-white/35">No live match right now. Start one from the matches desk.</p>
          )}
        </Panel>

        {/* 6 · stream floor & recording monitor */}
        <Panel title="Stream monitors" subtitle="End a floor or jump into the broadcast desk" action={<Link to="/admin/streams" className="text-[10px] font-semibold text-lime hover:underline">Open desk →</Link>} bodyClassName="!p-0">
          {live.length ? live.filter((match) => match.stream?.isLive).map((match) => (
            <div key={`stream-${match._id}`} className="border-b border-white/[0.05] px-4 py-2.5 last:border-0">
              <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", match.stream.recording ? "animate-pulseDot bg-coral" : "bg-mint")} />
                <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/80">{matchLabel(match)}</p>
                <span className="font-mono text-[10px] text-white/45">{formatNumber(match.stream.viewers || 0)}</span>
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[9px] text-white/30">
                <span className="uppercase tracking-wider text-lime/70">{match.stream.mode || "live"}</span>
                {match.stream.recording && <span className="text-coral">recording</span>}
                <span>{match.stream.startedAt ? `on air ${timeAgo(match.stream.startedAt)}` : ""}</span>
                {match.liveWindow?.remainingSeconds != null && (
                  <span className={match.liveWindow.remainingSeconds <= 0 ? "text-coral" : "text-amber-300/70"}>
                    {match.liveWindow.remainingSeconds <= 0
                      ? "live window reached"
                      : `${formatSeconds(match.liveWindow.remainingSeconds)} left`}
                  </span>
                )}
                {match.stream.livekitRoom && <span className="font-mono text-white/20">{match.stream.livekitRoom}</span>}
              </p>
            </div>
          )) : (
            <p className="px-4 py-10 text-center text-xs text-white/35">No stream is on air.</p>
          )}
        </Panel>
      </div>

      {/* 7 & 8 · task board + composer */}
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Ops task board" subtitle="Shared across every admin seat · moves broadcast instantly">
          <div className="grid gap-2 md:grid-cols-3">
            {COLUMNS.map((column) => {
              const rows = tasks.filter((task) => task.status === column.key);
              return (
                <div key={column.key} className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-2">
                  <div className="mb-2 flex items-center justify-between px-0.5">
                    <p className={cn("text-[9px] font-bold uppercase tracking-[0.16em]", column.accent)}>{column.label}</p>
                    <span className="rounded-full bg-white/[0.05] px-1.5 text-[9px] font-bold text-white/35">{rows.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {rows.length ? rows.map((task) => (
                      <TaskCard key={task._id} task={task} onMove={moveTask} onDelete={deleteTask} busy={busy} now={now} />
                    )) : (
                      <p className="rounded-lg border border-dashed border-white/[0.07] px-2 py-5 text-center text-[10px] text-white/20">Empty</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="New ops task" subtitle="Assign matchday jobs to the crew">
          <form onSubmit={createTask} className="space-y-2.5">
            <Field label="Title" required>
              <input value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} className="input !py-2 text-xs" placeholder="Check the third-man camera before toss" maxLength={140} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Priority">
                <select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })} className="input !py-2 text-xs">
                  {PRIORITIES.map((row) => <option key={row.key} value={row.key} className="bg-ink-900">{row.label}</option>)}
                </select>
              </Field>
              <Field label="Due">
                <input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm({ ...taskForm, dueAt: event.target.value })} className="input !py-2 text-xs" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Assignee">
                <input value={taskForm.assignedTo} onChange={(event) => setTaskForm({ ...taskForm, assignedTo: event.target.value })} className="input !py-2 text-xs" placeholder="Producer" />
              </Field>
              <Field label="Match">
                <select value={taskForm.matchId} onChange={(event) => setTaskForm({ ...taskForm, matchId: event.target.value })} className="input !py-2 text-xs">
                  <option value="" className="bg-ink-900">No match</option>
                  {[...live, ...upcoming].slice(0, 16).map((match) => <option key={match._id} value={match._id} className="bg-ink-900">{matchLabel(match)}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} rows={2} className="input !py-2 text-xs" placeholder="Context for whoever picks this up" maxLength={1000} />
            </Field>
            <button type="submit" disabled={busy === "task-create" || !taskForm.title.trim()} className="btn-primary btn-xs w-full justify-center">
              {busy === "task-create" ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Create task
            </button>
          </form>
        </Panel>
      </div>

      {/* 9 · chat moderation */}
      <Panel
        title="Live chat moderation"
        subtitle="Hide, pin or delete a fan message — the room updates immediately"
        action={
          <label className="relative">
            <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/25" />
            <input value={chatQuery} onChange={(event) => setChatQuery(event.target.value)} className="input !w-52 !py-1.5 pl-7 text-[10px]" placeholder="Search chat…" />
          </label>
        }
        bodyClassName="!p-0"
      >
        {chatRows.length ? chatRows.map((message) => (
          <div key={message._id} className={cn("flex flex-wrap items-start gap-2 border-b border-white/[0.05] px-4 py-2.5 last:border-0", message.isHidden && "opacity-50")}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[9px] font-bold text-white/55">{(message.user || "F").slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-[10px]">
                <span className="font-semibold text-white/75">{message.user}</span>
                <span className="text-white/25">{formatDateTime(message.createdAt)}</span>
                {message.match && <span className="text-white/25">· {matchLabel(message.match)}</span>}
                {message.isPinned && <Pill className="border-lime/25 bg-lime/[0.08] text-lime">pinned</Pill>}
                {message.isHidden && <Pill className="border-white/15 bg-white/[0.04] text-white/40">hidden</Pill>}
              </p>
              <p className={cn("mt-0.5 text-[11px] leading-relaxed text-white/60", message.isHidden && "line-through")}>{message.body}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" title={message.isPinned ? "Unpin" : "Pin"} onClick={() => moderate(message, { isPinned: !message.isPinned })} disabled={Boolean(busy)} className={cn("btn-ghost btn-xs", message.isPinned && "!text-lime")}><Pin size={10} /></button>
              <button type="button" title={message.isHidden ? "Unhide" : "Hide"} onClick={() => moderate(message, { isHidden: !message.isHidden })} disabled={Boolean(busy)} className="btn-ghost btn-xs"><Eye size={10} /></button>
              <button type="button" title="Delete" onClick={() => removeMessage(message)} disabled={Boolean(busy)} className="btn-danger btn-xs"><Trash2 size={10} /></button>
            </div>
          </div>
        )) : (
          <p className="px-4 py-10 text-center text-xs text-white/35">No chat messages found.</p>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* 10 · feature flags */}
        <Panel title="Feature flags" subtitle="Gates apply to every fan socket instantly" bodyClassName="space-y-2">
          {flags.map((flag) => (
            <button
              key={flag.key}
              type="button"
              onClick={() => toggleFlag(flag)}
              disabled={Boolean(busy)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-lime/25 disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold text-white/80">{flag.label}</span>
                <span className="block text-[9px] leading-relaxed text-white/30">{flag.description}</span>
              </span>
              <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition", flag.enabled ? "bg-lime" : "bg-white/15")}>
                <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-ink-950 transition", flag.enabled ? "left-[18px]" : "left-0.5")} />
              </span>
            </button>
          ))}
        </Panel>

        {/* 11 · announcements */}
        <Panel title="Fan announcement" subtitle="Push a notification to every connected fan">
          <form onSubmit={sendAnnouncement} className="space-y-2.5">
            <Field label="Title" required>
              <input value={announceForm.title} onChange={(event) => setAnnounceForm({ ...announceForm, title: event.target.value })} className="input !py-2 text-xs" placeholder="Second innings starts in 5" maxLength={120} />
            </Field>
            <Field label="Message" required>
              <textarea value={announceForm.body} onChange={(event) => setAnnounceForm({ ...announceForm, body: event.target.value })} rows={2} className="input !py-2 text-xs" placeholder="Players are walking out at Wankhede." maxLength={400} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <select value={announceForm.type} onChange={(event) => setAnnounceForm({ ...announceForm, type: event.target.value })} className="input !py-2 text-xs">
                  {["announcement", "match-start", "weather", "delay", "info"].map((row) => <option key={row} value={row} className="bg-ink-900">{row}</option>)}
                </select>
              </Field>
              <Field label="Match">
                <select value={announceForm.matchId} onChange={(event) => setAnnounceForm({ ...announceForm, matchId: event.target.value })} className="input !py-2 text-xs">
                  <option value="" className="bg-ink-900">Everyone</option>
                  {live.slice(0, 10).map((match) => <option key={match._id} value={match._id} className="bg-ink-900">{matchLabel(match)}</option>)}
                </select>
              </Field>
            </div>
            <button type="submit" disabled={busy === "announce" || !announceForm.title.trim() || !announceForm.body.trim()} className="btn-primary btn-xs w-full justify-center">
              {busy === "announce" ? <Loader2 size={12} className="animate-spin" /> : <Megaphone size={12} />} Send announcement
            </button>
          </form>
        </Panel>

        {/* 12 · health */}
        <Panel title="Server health" subtitle="Polled every 20s and refreshed on demand" bodyClassName="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Uptime", value: health.uptime ? `${Math.floor(health.uptime / 60)}m` : "—", icon: Clock },
              { label: "Sockets", value: formatNumber(health.sockets || 0), icon: Wifi },
              { label: "Heap", value: `${health.memory?.heapMb || 0} MB`, icon: Gauge },
              { label: "Node", value: health.node || "—", icon: Server },
            ].map((row) => (
              <div key={row.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                <p className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-white/25"><row.icon size={9} /> {row.label}</p>
                <p className="mt-0.5 font-mono text-[11px] font-semibold text-white/70">{row.value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 border-t border-white/[0.06] pt-2">
            <StatusDot active={health.db?.state === 1} label={`MongoDB · ${health.db?.label || "unknown"}`} />
            <StatusDot active={Boolean(health.cloudinary)} label="Cloudinary uploads" />
            <StatusDot active={Boolean(livekit.enabled)} label={livekit.enabled ? "LiveKit configured" : "LiveKit keys missing"} />
          </div>
          <p className="text-[9px] text-white/25">Linux/Windows process · {health.at ? timeAgo(health.at) : "never"} · {health.db?.name || "bethub"}</p>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* 13 · LiveKit rooms */}
        <Panel
          title="LiveKit rooms"
          subtitle={livekit.enabled ? `SFU at ${livekit.host || livekit.url}` : "Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to enable"}
          action={<Pill className={livekit.enabled ? "border-mint/25 bg-mint/[0.08] text-mint" : "border-amber-400/25 bg-amber-400/[0.08] text-amber-300"}>{livekit.enabled ? "configured" : "keys needed"}</Pill>}
          bodyClassName="!p-0"
        >
          {(livekit.rooms || []).length ? livekit.rooms.map((room) => (
            <div key={room.matchId} className="border-b border-white/[0.05] px-4 py-2.5 last:border-0">
              <div className="flex items-center gap-2">
                <Radio size={12} className={room.ok ? "text-lime" : "text-white/25"} />
                <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/80">{room.label}</p>
                <span className="text-[9px] text-white/30">{room.participants?.length || 0} participants</span>
              </div>
              <p className="mt-0.5 font-mono text-[9px] text-white/20">{room.room || "room not created"}</p>
              {room.participants?.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {room.participants.slice(0, 8).map((person) => (
                    <span key={person.identity} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[8px] text-white/45">
                      {person.isPublisher ? "● " : ""}{person.name || person.identity}
                    </span>
                  ))}
                </div>
              )}
              {!room.ok && room.reason && <p className="mt-0.5 text-[9px] text-amber-300/70">{room.reason}</p>}
            </div>
          )) : (
            <p className="px-4 py-10 text-center text-xs text-white/35">{livekit.enabled ? "No LiveKit room is live right now." : "LiveKit is not configured, so rooms cannot be listed."}</p>
          )}
        </Panel>

        {/* 14 · schedule countdown */}
        <Panel title="Next on the clock" subtitle="Realtime countdown to the next fixtures" bodyClassName="!p-0">
          {upcoming.length ? upcoming.slice(0, 5).map((match) => (
            <div key={match._id} className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5 last:border-0">
              <div className="flex shrink-0 -space-x-1.5"><TeamLogo team={match.teamA} size="xs" /><TeamLogo team={match.teamB} size="xs" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-white/80">{matchLabel(match)}</p>
                <p className="truncate text-[9px] text-white/30">{match.series} · {match.venue || "venue TBC"}</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] font-semibold text-sky">{countdown(match.startTime, now)}</span>
            </div>
          )) : (
            <p className="px-4 py-10 text-center text-xs text-white/35">No upcoming fixtures scheduled.</p>
          )}
        </Panel>
      </div>

      {/* 15 · audit activity feed + filters */}
      <Panel
        title="Activity & audit feed"
        subtitle="Every admin action, stream change and flag flip is recorded"
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="relative">
              <Search size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/25" />
              <input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} className="input !w-44 !py-1.5 pl-7 text-[10px]" placeholder="Search audit…" />
            </label>
            <select value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)} className="input !w-auto !py-1.5 text-[10px]">
              {AUDIT_CATEGORIES.map((row) => <option key={row} value={row} className="bg-ink-900">{row}</option>)}
            </select>
          </div>
        }
        bodyClassName="!p-0"
      >
        {auditRows.length ? auditRows.map((log) => (
          <div key={log._id} className="flex items-start gap-2 border-b border-white/[0.05] px-4 py-2 last:border-0">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-white/[0.05] text-[8px] font-bold uppercase text-white/45">{log.category?.slice(0, 2)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-medium text-white/70">{log.summary || log.action}</p>
              <p className="text-[9px] text-white/25">{log.actor?.name || "System"} · {log.action} · {formatDateTime(log.at || log.createdAt)}</p>
            </div>
            <span className="shrink-0 text-[9px] text-white/20">{timeAgo(log.at || log.createdAt)}</span>
          </div>
        )) : (
          <p className="px-4 py-10 text-center text-xs text-white/35">No audit entries match that filter.</p>
        )}
      </Panel>

      {/* 16 · CSV exports */}
      <Panel title="Data exports" subtitle="Admin-only CSV downloads · every export is logged in the audit trail">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {EXPORTS.map((row) => (
            <button key={row.type} type="button" onClick={() => downloadCsv(row.type)} disabled={Boolean(busy)} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-3 text-center transition hover:border-lime/30 hover:bg-lime/[0.04] disabled:opacity-50">
              {busy === `export-${row.type}` ? <Loader2 size={15} className="mx-auto mb-1 animate-spin text-lime" /> : <Download size={15} className="mx-auto mb-1 text-lime" />}
              <span className="block text-[10px] font-semibold text-white/65">{row.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[10px] text-white/30">
          <span className="inline-flex items-center gap-1.5"><Flag size={11} /> {formatNumber(counts.matches || 0)} matches · {formatNumber(counts.players || 0)} players · {formatNumber(counts.teams || 0)} teams · {formatNumber(counts.countries || 0)} countries</span>
          <span>{data?.generatedAt ? `snapshot ${timeAgo(data.generatedAt)}` : ""}</span>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lime/15 bg-gradient-to-r from-lime/[0.07] to-transparent px-4 py-3">
        <p className="flex items-center gap-2 text-xs text-white/55">
          <Zap size={14} className="text-lime" /> Every control on this page runs without a reload — sockets keep all admin seats in sync.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/streams" className="btn-ghost btn-xs"><Tv size={12} /> Stream desk</Link>
          <Link to="/admin/matches" className="btn-ghost btn-xs"><Activity size={12} /> Match desk</Link>
          <Link to="/live" className="btn-ghost btn-xs"><Eye size={12} /> Fan view</Link>
        </div>
      </div>
    </AdminPage>
  );
}
