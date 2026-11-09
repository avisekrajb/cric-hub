import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronRight,
  Clapperboard,
  Command,
  Flag,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Radio,
  Search,
  Settings,
  Shield,
  Sun,
  Tv,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import Logo from "../components/common/Logo";
import { PageLoader } from "../components/common/States";
import { useAuth } from "../contexts/AuthContext";
import { useSocket, useSocketEvent } from "../contexts/SocketContext";
import { useTheme } from "../contexts/ThemeContext";
import { cn, timeAgo } from "../lib/utils";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/ops", label: "Realtime ops", icon: Activity, hint: "20 live controls" },
  { to: "/admin/matches", label: "Matches", icon: Shield },
  { to: "/admin/streams", label: "Live streams", icon: Tv },
  { to: "/admin/teams", label: "Teams", icon: Users },
  { to: "/admin/players", label: "Players", icon: UserRound },
  { to: "/admin/countries", label: "Countries", icon: Flag },
  { to: "/admin/media", label: "Media library", icon: Clapperboard },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const paletteCommands = [
  { label: "Realtime ops control room", hint: "Pulse, tasks, moderation, flags", to: "/admin/ops", icon: Activity },
  { label: "Matchday dashboard", hint: "Live snapshot", to: "/admin", icon: LayoutDashboard },
  { label: "Create a new match", hint: "Teams, squads, toss", to: "/admin/matches/new", icon: Shield },
  { label: "Manage matches", hint: "Fixtures and results", to: "/admin/matches", icon: Shield },
  { label: "Stream desk", hint: "Go live with LiveKit, camera, HLS or embed", to: "/admin/streams", icon: Tv },
  { label: "Teams", hint: "Squads and captains", to: "/admin/teams", icon: Users },
  { label: "Players", hint: "Profiles and photos", to: "/admin/players", icon: UserRound },
  { label: "Countries", hint: "108-country directory", to: "/admin/countries", icon: Flag },
  { label: "Media library", hint: "Videos and highlights", to: "/admin/media", icon: Clapperboard },
  { label: "Settings", hint: "Profile and account", to: "/admin/settings", icon: Settings },
  { label: "Public score centre", hint: "Open the fan site", to: "/live", icon: Radio },
  { label: "Public stats", hint: "Fan-facing analytics", to: "/stats", icon: BarChart3 },
  { label: "Video hub", hint: "Public highlights", to: "/videos", icon: Clapperboard },
];

function Sidebar({ onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
        <Logo />
        <span className="ml-2 rounded bg-lime/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-lime">Admin</span>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/20">Control room</p>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            className={({ isActive }) => cn("admin-link", isActive && "admin-link-active")}
          >
            <link.icon size={16} />
            {link.label}
            {link.hint && <span className="ml-auto rounded bg-lime/10 px-1 py-0.5 text-[7px] font-bold uppercase tracking-wider text-lime/80">live</span>}
            {!link.hint && <ChevronRight size={13} className="ml-auto opacity-30" />}
          </NavLink>
        ))}
        <p className="px-3 pb-1 pt-4 text-[9px] font-bold uppercase tracking-[0.18em] text-white/20">Shortcuts</p>
        <Link to="/live" className="admin-link" onClick={onNavigate}><Radio size={16} className="text-coral" /> Live score centre</Link>
        <Link to="/stats" className="admin-link" onClick={onNavigate}><BarChart3 size={16} /> Public stats</Link>
        <Link to="/videos" className="admin-link" onClick={onNavigate}><Clapperboard size={16} /> Video hub</Link>
      </div>
      <div className="border-t border-white/[0.06] p-3">
        <Link to="/" className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[11px] text-white/45 transition hover:border-lime/25 hover:text-white">
          <Globe2 size={14} className="text-lime" /> View public site
        </Link>
      </div>
    </div>
  );
}

export function AdminGuard() {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your scorer pass…" />;
  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return paletteCommands;
    return paletteCommands.filter((row) => `${row.label} ${row.hint}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setActive(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const choose = (row) => {
    if (!row) return;
    navigate(row.to);
    onClose();
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => Math.min(results.length - 1, value + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => Math.max(0, value - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-card" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-3.5 py-3">
          <Search size={15} className="shrink-0 text-white/30" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to any admin page…"
            className="w-full bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
          />
          <button type="button" onClick={onClose} className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-white/35">ESC</button>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length ? results.map((row, index) => (
            <button
              key={row.to + row.label}
              type="button"
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(row)}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition", index === active ? "bg-lime/10 text-lime" : "text-white/60 hover:bg-white/[0.04]")}
            >
              <row.icon size={14} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold">{row.label}</span>
                <span className="block truncate text-[9px] text-white/30">{row.hint}</span>
              </span>
              <ChevronRight size={12} className="opacity-30" />
            </button>
          )) : (
            <p className="px-3 py-8 text-center text-[11px] text-white/30">No page matches “{query}”.</p>
          )}
        </div>
        <p className="border-t border-white/[0.07] px-3.5 py-2 text-[9px] text-white/25">↑ ↓ navigate · Enter open · Ctrl K toggle</p>
      </div>
    </div>
  );
}

export default function AdminShell() {
  const { user, logout } = useAuth();
  const { socket, connected, online } = useSocket();
  const { isDark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    setBellOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit("admin:page", { path: location.pathname + location.search });
  }, [socket, connected, location.pathname, location.search]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useSocketEvent("notification", (payload) => {
    if (!payload) return;
    setNotifications((rows) => [{ kind: "notification", ...payload }, ...rows].slice(0, 24));
    setUnread((value) => value + 1);
  });

  useSocketEvent("ops:audit", (log) => {
    if (!log?.action) return;
    setNotifications((rows) => [{
      kind: "audit",
      id: log._id,
      title: log.summary || log.action,
      body: `${log.actor?.name || "System"} · ${log.category}`,
      at: log.at || log.createdAt,
      icon: "audit",
    }, ...rows].slice(0, 24));
    setUnread((value) => value + 1);
  });

  useSocketEvent("ops:task", ({ type, task } = {}) => {
    if (!task?.title || type === "deleted") return;
    setNotifications((rows) => [{
      kind: "task",
      id: `${task._id}-${type}`,
      title: `Ops task ${type}`,
      body: task.title,
      at: new Date().toISOString(),
      icon: "task",
    }, ...rows].slice(0, 24));
    setUnread((value) => value + 1);
  });

  const openBell = () => {
    setBellOpen((value) => !value);
    setUnread(0);
  };

  const signOut = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/[0.06] bg-ink-950/80 backdrop-blur-2xl lg:block">
        <Sidebar />
      </aside>

      {open && (
        <div className="fixed inset-0 z-[65] lg:hidden">
          <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="relative h-full w-[min(86vw,300px)] border-r border-white/10 bg-ink-950 shadow-card">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Close">
              <X size={17} />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur-2xl sm:px-6">
          <button onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 lg:hidden" aria-label="Open menu">
            <Menu size={17} />
          </button>
          <div className="hidden items-center gap-2 lg:flex">
            <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-mint" : "bg-coral")} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{connected ? "Realtime connected" : "Reconnecting…"}</span>
            {connected && <span className="text-[10px] text-white/20">· {online} online</span>}
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/35 transition hover:border-lime/25 hover:text-white/70 md:flex"
          >
            <Command size={12} /> Quick jump <span className="ml-1 rounded border border-white/10 px-1 py-0.5 text-[8px]">Ctrl K</span>
          </button>

          <div className="relative ml-auto md:ml-0">
            <button
              type="button"
              onClick={openBell}
              className={cn("relative grid h-9 w-9 place-items-center rounded-lg border bg-white/[0.04] text-white/50 transition hover:border-lime/30 hover:text-lime", bellOpen ? "border-lime/30 text-lime" : "border-white/10")}
              title="Live notifications"
              aria-label="Live notifications"
            >
              <Bell size={15} />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[8px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-11 z-50 w-[min(92vw,340px)] overflow-hidden rounded-xl border border-white/10 bg-ink-950 shadow-card">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2">
                  <p className="text-[11px] font-bold text-white/80">Live notifications</p>
                  <button type="button" onClick={() => { setNotifications([]); setUnread(0); }} className="text-[9px] text-white/30 hover:text-lime">Clear</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length ? notifications.map((row, index) => (
                    <div key={`${row.id || row.at}-${index}`} className="flex items-start gap-2 border-b border-white/[0.05] px-3 py-2 last:border-0">
                      <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg", row.kind === "notification" ? "bg-coral/10 text-coral" : row.kind === "task" ? "bg-amber-400/10 text-amber-300" : "bg-lime/10 text-lime")}>
                        {row.kind === "notification" ? <Zap size={11} /> : row.kind === "task" ? <Activity size={11} /> : <Shield size={11} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-semibold text-white/75">{row.title}</p>
                        <p className="line-clamp-2 text-[9px] leading-relaxed text-white/35">{row.body}</p>
                      </div>
                      <span className="shrink-0 text-[8px] text-white/20">{timeAgo(row.at)}</span>
                    </div>
                  )) : (
                    <p className="px-3 py-8 text-center text-[10px] text-white/30">No notifications yet.</p>
                  )}
                </div>
                <Link to="/admin/ops" onClick={() => setBellOpen(false)} className="block border-t border-white/[0.07] px-3 py-2 text-center text-[10px] font-semibold text-lime hover:bg-lime/[0.05]">
                  Open the ops control room →
                </Link>
              </div>
            )}
          </div>

          <Link to="/admin/matches/new" className="btn-primary btn-xs hidden sm:inline-flex">New match</Link>
          <button
            type="button"
            onClick={toggle}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:border-lime/30 hover:text-lime"
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-1.5 pl-1.5 pr-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-lime text-[10px] font-bold text-ink-950">{(user?.name || "A").slice(0, 1).toUpperCase()}</span>
            <div className="hidden text-left sm:block">
              <p className="max-w-[110px] truncate text-[11px] font-semibold leading-tight text-white/80">{user?.name || "Admin"}</p>
              <p className="text-[9px] uppercase tracking-wider text-white/30">{user?.role}</p>
            </div>
          </div>
          <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:border-coral/30 hover:text-coral" title="Sign out">
            <LogOut size={15} />
          </button>
        </header>

        <main className="p-4 sm:p-6 lg:p-7">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
