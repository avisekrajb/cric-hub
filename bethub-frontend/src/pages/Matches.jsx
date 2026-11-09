import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Filter, Radio, Search, Trophy } from "lucide-react";
import MatchCard from "../components/MatchCard";
import { EmptyState, PageLoader } from "../components/common/States";
import Tabs from "../components/common/Tabs";
import { useFetch } from "../hooks/useFetch";
import { useSocketEvent } from "../contexts/SocketContext";
import { useI18n } from "../contexts/LanguageContext";
import { isLive } from "../lib/utils";

export default function Matches() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "all";
  const series = params.get("series") || "all";
  const [search, setSearch] = useState("");
  const { data, loading, refetch, setData } = useFetch("/api/matches?scope=public&limit=120", { poll: 30000 });
  const [liveCount, setLiveCount] = useState(0);
  const timerRef = useRef(null);

  const tabs = [
    { key: "all", label: t("matches.tabAll") },
    { key: "live", label: t("matches.tabLive") },
    { key: "upcoming", label: t("matches.tabUpcoming") },
    { key: "finished", label: t("matches.tabResults") },
  ];

  useSocketEvent("score:update", ({ match }) => {
    if (!match) return;
    setData((current) => {
      if (!current?.matches) return current;
      const exists = current.matches.some((row) => row._id === match._id);
      return {
        ...current,
        matches: exists ? current.matches.map((row) => (row._id === match._id ? match : row)) : [match, ...current.matches],
      };
    });
  });

  useSocketEvent("notification", () => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      refetch(true);
    }, 1500);
  });

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const matches = data?.matches || [];
  useEffect(() => {
    setLiveCount(matches.filter((match) => isLive(match)).length);
  }, [matches]);

  const seriesOptions = useMemo(() => {
    const set = new Set(matches.map((match) => match.series).filter(Boolean));
    return [...set];
  }, [matches]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return matches
      .filter((match) => {
        if (tab === "live" && !isLive(match)) return false;
        if (tab === "upcoming" && match.status !== "upcoming") return false;
        if (tab === "finished" && match.status !== "finished") return false;
        if (series !== "all" && match.series !== series) return false;
        if (term) {
          const haystack = `${match.teamA?.name} ${match.teamB?.name} ${match.teamA?.shortName} ${match.teamB?.shortName} ${match.series} ${match.venue}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const rank = { live: 0, "innings-break": 0, upcoming: 1, finished: 2, abandoned: 3 };
        const ra = rank[a.status] ?? 4;
        const rb = rank[b.status] ?? 4;
        if (ra !== rb) return ra - rb;
        if (ra === 1) return new Date(a.startTime) - new Date(b.startTime);
        return new Date(b.startTime) - new Date(a.startTime);
      });
  }, [matches, tab, series, search]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const groups = useMemo(() => {
    const buckets = [
      { key: "live", titleKey: "matches.groupLive", hintKey: "matches.groupLiveHint", matches: filtered.filter((match) => isLive(match)) },
      { key: "upcoming", titleKey: "matches.groupUpcoming", hintKey: "matches.groupUpcomingHint", matches: filtered.filter((match) => match.status === "upcoming") },
      { key: "finished", titleKey: "matches.groupFinished", hintKey: "matches.groupFinishedHint", matches: filtered.filter((match) => match.status === "finished") },
    ];
    if (tab !== "all") return buckets.filter((bucket) => bucket.key === tab && bucket.matches.length);
    return buckets.filter((bucket) => bucket.matches.length);
  }, [filtered, tab]);

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2"><Radio size={13} /> {t("matches.scoreCentre")}</p>
          <h1 className="mt-1 font-display text-3xl font-700 tracking-tight text-white sm:text-4xl">{t("matches.title")}</h1>
          <p className="mt-1 text-sm text-white/45">{t("matches.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip !border-coral/20 !bg-coral/10 !text-coral"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-coral" /> {t("matches.liveCount", { count: liveCount })}</span>
          <span className="chip"><Trophy size={11} /> {t("matches.matchCount", { count: matches.length })}</span>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs tabs={tabs} value={tab} onChange={(value) => setParam("tab", value)} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("matches.search")} className="input !py-2 pl-9 text-xs sm:w-56" />
          </label>
          <label className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/60 px-3">
            <Filter size={13} className="text-white/30" />
            <select
              value={series}
              onChange={(event) => setParam("series", event.target.value)}
              className="w-full bg-transparent py-2 text-xs text-white/70 outline-none sm:w-48"
            >
              <option value="all" className="bg-ink-900">{t("common.allSeries")}</option>
              {seriesOptions.map((name) => (
                <option key={name} value={name} className="bg-ink-900">{name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {series !== "all" && (
        <div className="mb-4 flex items-center gap-2 text-xs text-white/50">
          <CalendarDays size={13} className="text-lime" /> {t("matches.showing")} <span className="font-semibold text-white">{series}</span>
          <button onClick={() => setParam("series", "all")} className="ml-1 rounded bg-white/[0.06] px-2 py-0.5 text-[10px] hover:bg-white/10">{t("common.clear")}</button>
        </div>
      )}

      {loading && !data ? (
        <PageLoader label={t("matches.loading")} />
      ) : filtered.length ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">{t(group.hintKey)}</p>
                  <h2 className="section-title flex items-center gap-2">
                    {group.key === "live" && <span className="h-2 w-2 animate-pulseDot rounded-full bg-coral" />}
                    {t(group.titleKey)}
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-white/45">{group.matches.length}</span>
                  </h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {group.matches.map((match) => <MatchCard key={match._id} match={match} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Radio size={20} />}
          title={tab === "live" ? t("matches.noLive") : t("matches.noMatches")}
          text={search || series !== "all" ? t("matches.tryClear") : t("matches.newMatches")}
          action={
            (search || series !== "all" || tab !== "all") && (
              <button className="btn-ghost btn-xs" onClick={() => { setSearch(""); setParams({}, { replace: true }); }}>
                {t("matches.reset")}
              </button>
            )
          }
        />
      )}
    </div>
  );
}
