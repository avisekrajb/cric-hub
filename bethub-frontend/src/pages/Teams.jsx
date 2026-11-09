import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Shield, Trophy, UserRound, Users } from "lucide-react";
import { CountryFlag, TeamLogo } from "../components/common/Avatars";
import { EmptyState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useI18n } from "../contexts/LanguageContext";

export default function Teams() {
  const { t } = useI18n();
  const { data, loading } = useFetch("/api/teams?active=all", { poll: 90000 });
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");

  const teams = data?.teams || [];
  const countries = useMemo(
    () => [...new Map(teams.filter((row) => row.country).map((row) => [row.country._id, row.country])).values()],
    [teams]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return teams.filter((team) => {
      if (country !== "all" && String(team.country?._id) !== country) return false;
      if (!term) return true;
      return `${team.name} ${team.shortName} ${team.country?.name} ${team.coach} ${team.homeGround}`.toLowerCase().includes(term);
    });
  }, [teams, search, country]);

  if (loading && !data) return <PageLoader label={t("teams.loading")} />;

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2"><Shield size={13} /> {t("teams.directory")}</p>
          <h1 className="mt-1 font-display text-3xl font-700 tracking-tight text-white sm:text-4xl">{t("teams.title")}</h1>
          <p className="mt-1 text-sm text-white/45">{t("teams.subtitle")}</p>
        </div>
        <span className="chip"><Users size={11} className="text-lime" /> {t("teams.count", { count: teams.length })}</span>
      </div>

      <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative flex-1 sm:max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("teams.search")} className="input !py-2 pl-9 text-xs" />
        </label>
        <select value={country} onChange={(event) => setCountry(event.target.value)} className="input !w-auto !py-2 text-xs">
          <option value="all" className="bg-ink-900">{t("common.allCountries")}</option>
          {countries.map((row) => <option key={row._id} value={row._id} className="bg-ink-900">{row.name}</option>)}
        </select>
      </div>

      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((team) => (
            <Link key={team._id} to={`/teams/${team._id}`} className="card card-hover group relative overflow-hidden p-4">
              <span className="absolute inset-x-0 top-0 h-0.5 opacity-60" style={{ background: team.color || "#00e28a" }} />
              <div className="flex items-start justify-between gap-2">
                <TeamLogo team={team} size="lg" />
                <div className="flex items-center gap-1.5 text-[10px] text-white/35">
                  <CountryFlag country={team.country} /> {team.country?.code}
                </div>
              </div>
              <div className="mt-3">
                <p className="truncate font-display text-base font-700 text-white group-hover:text-lime">{team.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-white/40">{team.country?.name}{team.homeGround ? ` · ${team.homeGround}` : ""}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-2.5 text-[10px]">
                <span className="text-white/40"><b className="font-mono text-sm text-white/80">{team.playerCount ?? team.players?.length ?? 0}</b> {t("teams.players")}</span>
                <span className="truncate text-right text-white/40">{team.captain?.name ? `C · ${team.captain.name}` : t("teams.captainTbc")}</span>
              </div>
              <span className="mt-3 flex items-center justify-between text-[10px] font-semibold text-lime">
                <span className="inline-flex items-center gap-1"><Trophy size={11} /> {team.shortName}</span>
                <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={<UserRound size={20} />} title={t("teams.emptyTitle")} text={t("teams.emptyText")} />
      )}
    </div>
  );
}
