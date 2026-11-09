import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Filter, Search, UserRound, Users } from "lucide-react";
import { CountryFlag, PlayerAvatar } from "../components/common/Avatars";
import { EmptyState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useI18n } from "../contexts/LanguageContext";
import { cn, formatNumber } from "../lib/utils";

const roles = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];

export default function Players() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const role = params.get("role") || "all";
  const country = params.get("country") || "all";
  const { data, loading } = useFetch("/api/players?limit=200", { poll: 90000 });
  const { data: countryData } = useFetch("/api/countries?active=all");

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const players = data?.players || [];
  const countries = countryData?.countries || [];

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return players.filter((player) => {
      if (role !== "all" && player.role !== role) return false;
      if (country !== "all" && String(player.country?._id) !== country) return false;
      if (!term) return true;
      return `${player.name} ${player.birthplace} ${player.country?.name} ${player.role}`.toLowerCase().includes(term);
    });
  }, [players, q, role, country]);

  if (loading && !data) return <PageLoader label={t("players.loading")} />;

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2"><UserRound size={13} /> {t("players.directory")}</p>
          <h1 className="mt-1 font-display text-3xl font-700 tracking-tight text-white sm:text-4xl">{t("players.title")}</h1>
          <p className="mt-1 text-sm text-white/45">{t("players.subtitle")}</p>
        </div>
        <span className="chip"><Users size={11} className="text-lime" /> {t("players.count", { count: players.length })}</span>
      </div>

      <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative flex-1 lg:max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={q} onChange={(event) => setParam("q", event.target.value)} placeholder={t("players.search")} className="input !py-2 pl-9 text-xs" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/30"><Filter size={11} /> {t("players.role")}</span>
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            <button onClick={() => setParam("role", "all")} className={cn("chip transition", role === "all" && "!border-lime/30 !bg-lime/10 !text-lime")}>{t("common.all")}</button>
            {roles.map((item) => (
              <button key={item} onClick={() => setParam("role", item)} className={cn("chip whitespace-nowrap transition", role === item && "!border-lime/30 !bg-lime/10 !text-lime")}>{item}</button>
            ))}
          </div>
          <select value={country} onChange={(event) => setParam("country", event.target.value)} className="input !w-auto !py-1.5 text-[11px]">
            <option value="all" className="bg-ink-900">{t("common.allCountries")}</option>
            {countries.map((row) => <option key={row._id} value={row._id} className="bg-ink-900">{row.name}</option>)}
          </select>
        </div>
      </div>

      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((player) => (
            <Link key={player._id} to={`/players/${player._id}`} className="card card-hover group flex items-center gap-3 p-3.5">
              <PlayerAvatar player={player} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white group-hover:text-lime">
                  {player.name}
                  {player.isCaptain && <span className="rounded bg-lime/15 px-1 text-[8px] font-bold text-lime">C</span>}
                  {player.isWicketkeeper && <span className="rounded bg-sky/15 px-1 text-[8px] font-bold text-sky">WK</span>}
                </p>
                <p className="truncate text-[10px] text-white/40">{player.role} · {player.battingStyle || "—"}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/30">
                  <CountryFlag country={player.country} /> {player.country?.name || "—"}
                  {player.jerseyNumber ? <span className="ml-auto font-mono text-white/35">#{player.jerseyNumber}</span> : null}
                </p>
              </div>
              <ArrowRight size={13} className="shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-lime" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={<UserRound size={20} />} title={t("players.emptyTitle")} text={q || role !== "all" || country !== "all" ? t("players.emptyTextFilters") : t("players.emptyText")} />
      )}

      <p className="mt-4 text-center text-[10px] text-white/25">{t("players.footer", { filtered: formatNumber(filtered.length), total: formatNumber(players.length) })}</p>
    </div>
  );
}
