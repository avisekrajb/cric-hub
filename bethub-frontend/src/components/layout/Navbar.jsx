import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronDown,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Radio,
  Search,
  Settings,
  Sun,
  Tv,
  User,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Logo from "../common/Logo";
import LanguageSwitcher from "../common/LanguageSwitcher";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useI18n } from "../../contexts/LanguageContext";
import { cn } from "../../lib/utils";

const links = [
  { to: "/", key: "nav.home", icon: Home, end: true },
  { to: "/live", key: "nav.liveScores", icon: Radio },
  { to: "/videos", key: "nav.videos", icon: Tv },
  { to: "/teams", key: "nav.teams", icon: Users },
  { to: "/players", key: "nav.players", icon: UserRound },
  { to: "/stats", key: "nav.stats", icon: BarChart3 },
];

function ThemeToggle({ compact = false }) {
  const { isDark, toggle } = useTheme();
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t("nav.switchToLight") : t("nav.switchToDark")}
      title={isDark ? t("nav.lightMode") : t("nav.darkMode")}
      className={cn(
        "relative grid place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-lime/40 hover:text-lime",
        compact ? "h-9 w-9" : "h-9 w-9"
      )}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export default function Navbar() {
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const { user, logout } = useAuth();
  const { connected, online } = useSocket();
  const { isDark, toggle } = useTheme();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setDrawer(false);
    setMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (event) => event.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const submitSearch = (event) => {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/players?q=${encodeURIComponent(term)}` : "/players");
    setSearch("");
    setDrawer(false);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-2xl">
        <div className="container-x flex h-16 items-center gap-2.5">
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label={t("nav.openMenu")}
            aria-expanded={drawer}
          >
            <Menu size={18} />
          </button>

          <Logo />

          <nav className="ml-5 hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    "relative rounded-lg px-3 py-2 text-sm font-medium transition",
                    isActive ? "text-lime" : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                  )
                }
              >
                {t(link.key)}
                <span className="absolute inset-x-3 -bottom-[13px] hidden h-0.5 rounded-full bg-lime lg:block" />
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <form onSubmit={submitSearch} className="relative hidden xl:block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("nav.searchPlayers")}
                className="h-9 w-48 rounded-lg border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 text-xs text-white placeholder:text-white/30 outline-none transition focus:w-56 focus:border-lime/40"
              />
            </form>

            <span
              className="hidden items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-white/45 sm:inline-flex"
              title={t("nav.realtimeConnection")}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-mint" : "bg-coral")} />
              {connected ? t("nav.online", { count: online || 1 }) : t("nav.offline")}
            </span>

            <Link to="/live" className="btn-ghost btn-xs hidden sm:inline-flex">
              <Radio size={13} className="text-coral" /> {t("nav.watchLive")}
            </Link>

            <LanguageSwitcher />

            <ThemeToggle />

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenu((value) => !value)}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-1.5 pl-1.5 pr-2.5 text-xs font-semibold text-white/75 transition hover:border-lime/30"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-lime text-[10px] font-bold text-ink-950">
                    {(user.name || "A").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[90px] truncate sm:block">{user.name?.split(" ")[0] || "Admin"}</span>
                  <ChevronDown size={13} className={cn("transition", menu && "rotate-180")} />
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-ink-900 p-1.5 shadow-card">
                    <div className="px-3 py-2">
                      <p className="truncate text-xs font-semibold text-white">{user.name}</p>
                      <p className="truncate text-[10px] text-white/40">{user.email}</p>
                    </div>
                    <Link to="/admin" className="admin-link">
                      <LayoutDashboard size={15} /> {t("nav.adminDashboard")}
                    </Link>
                    <Link to="/admin/settings" className="admin-link">
                      <Settings size={15} /> {t("nav.settings")}
                    </Link>
                    <button onClick={logout} className="admin-link w-full text-left !text-coral hover:!bg-coral/10">
                      <LogOut size={15} /> {t("nav.signOut")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/admin/login" className="btn-primary btn-xs hidden sm:inline-flex">
                <LogIn size={13} /> {t("nav.admin")}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* left-to-right drawer */}
      <div
        className={cn(
          "fixed inset-0 z-[80] lg:hidden",
          drawer ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!drawer}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200",
            drawer ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setDrawer(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(86vw,330px)] flex-col border-r border-white/10 bg-ink-950 shadow-card transition-transform duration-300 ease-out",
            drawer ? "translate-x-0" : "-translate-x-full"
          )}
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.mainMenu")}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
            <Logo />
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70"
              aria-label={t("nav.closeMenu")}
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <form onSubmit={submitSearch} className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("nav.searchPlayers")}
                className="input pl-9"
              />
            </form>

            <nav className="grid gap-1">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                        isActive
                          ? "bg-lime/10 text-lime"
                          : "text-white/65 hover:bg-white/[0.05] hover:text-white"
                      )
                    }
                  >
                    <Icon size={17} />
                    {t(link.key)}
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-5">
              <LanguageSwitcher variant="block" />
            </div>

            <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                {isDark ? <Moon size={12} /> : <Sun size={12} />} {t("nav.appearance")}
              </p>
              <button
                type="button"
                onClick={toggle}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-white/75"
              >
                <span>{isDark ? t("nav.darkMode") : t("nav.lightMode")}</span>
                <span className={cn("relative h-5 w-9 rounded-full transition", isDark ? "bg-lime" : "bg-white/15")}>
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-ink-950 transition-all",
                      isDark ? "left-[18px]" : "left-0.5"
                    )}
                  />
                </span>
              </button>
            </div>
          </div>

          <div className="border-t border-white/[0.06] px-3 py-3">
            {user ? (
              <div className="grid gap-1">
                <Link to="/admin" className="admin-link">
                  <LayoutDashboard size={16} /> {t("nav.adminDashboard")}
                </Link>
                <Link to="/admin/settings" className="admin-link">
                  <Settings size={16} /> {t("nav.settings")}
                </Link>
                <button onClick={logout} className="admin-link w-full text-left !text-coral hover:!bg-coral/10">
                  <LogOut size={16} /> {t("nav.signOut")}
                </button>
              </div>
            ) : (
              <Link to="/admin/login" className="btn-primary w-full">
                <LogIn size={15} /> {t("nav.adminLogin")}
              </Link>
            )}
            <p className="mt-3 flex items-center gap-1.5 px-1 text-[10px] text-white/35">
              <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-mint" : "bg-coral")} />
              {connected ? t("nav.fansOnline", { count: online || 1 }) : t("nav.reconnecting")}
              <User size={11} className="ml-auto" />
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
