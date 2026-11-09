import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, CalendarDays, Eye, Play, Radio, Sparkles, Tv, Users, Zap } from "lucide-react";
import MatchCard, { CompactMatchRow } from "../components/MatchCard";
import VideoCard from "../components/VideoCard";
import { PageLoader, EmptyState, SkeletonCard } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useSocketEvent } from "../contexts/SocketContext";
import { useI18n } from "../contexts/LanguageContext";
import { cn, formatNumber } from "../lib/utils";

function HeroFallback() {
  const { t } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-900 p-6 shadow-card sm:p-9">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-lime/10 blur-3xl" />
      <div className="absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-mint/10 blur-3xl" />
      <div className="relative max-w-2xl">
        <p className="eyebrow mb-3 flex items-center gap-2"><Sparkles size={13} /> {t("home.heroEyebrow")}</p>
        <h1 className="font-display text-4xl font-700 leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
          {t("home.heroTitle1")} <span className="gradient-text">{t("home.heroTitle2")}</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/50 sm:text-base">{t("home.heroText")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/live" className="btn-primary"><Radio size={15} /> {t("home.liveScores")}</Link>
          <Link to="/videos" className="btn-ghost"><Play size={14} /> {t("home.watchHighlights")}</Link>
        </div>
        <div className="mt-8 flex flex-wrap gap-5 text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1.5"><Zap size={12} className="text-lime" /> {t("home.ballByBall")}</span>
          <span className="inline-flex items-center gap-1.5"><Tv size={12} className="text-lime" /> {t("home.liveVideoReplays")}</span>
          <span className="inline-flex items-center gap-1.5"><Users size={12} className="text-lime" /> {t("home.chatReactionsStats")}</span>
        </div>
      </div>
    </div>
  );
}

function StatStrip({ counts }) {
  const { t } = useI18n();
  const stats = [
    { label: t("home.statLiveMatches"), value: counts?.live || 0, icon: Radio, accent: "text-coral" },
    { label: t("home.statLiveStreams"), value: counts?.liveStreams || 0, icon: Tv, accent: "text-lime" },
    { label: t("home.statWatchingNow"), value: counts?.viewers || 0, icon: Users, accent: "text-mint" },
    { label: t("home.statMatchViews"), value: counts?.views || 0, icon: Eye, accent: "text-sky" },
    { label: t("home.statTeams"), value: counts?.teams || 0, icon: Activity, accent: "text-lime" },
    { label: t("home.statPlayers"), value: counts?.players || 0, icon: Users, accent: "text-white/70" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
            <stat.icon size={10} className={stat.accent} /> {stat.label}
          </p>
          <p className="mt-0.5 font-display text-xl font-700 tabular-nums text-white">{formatNumber(stat.value)}</p>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { t } = useI18n();
  const { data, loading, refetch, setData } = useFetch("/api/stats/overview", { poll: 45000 });
  const timerRef = useRef(null);

  const scheduleRefresh = () => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      refetch(true);
    }, 1800);
  };

  useSocketEvent("score:update", ({ match }) => {
    if (!match) return;
    setData((current) => {
      if (!current) return current;
      const live = current.live || [];
      const exists = live.some((row) => row._id === match._id);
      const nextLive = exists ? live.map((row) => (row._id === match._id ? match : row)) : [...live, match];
      return { ...current, live: nextLive };
    });
    scheduleRefresh();
  });

  useSocketEvent("notification", scheduleRefresh);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const featured = useMemo(() => {
    const live = data?.live || [];
    return live.find((match) => match.isFeatured) || live[0] || null;
  }, [data]);

  if (loading && !data) return <PageLoader label={t("home.loading")} />;
  if (!data) return <EmptyState title={t("home.quiet")} text={t("home.quietText")} />;

  return (
    <div className="container-x space-y-10 py-6 sm:py-8">
      <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div>{featured ? <MatchCard match={featured} variant="hero" /> : <HeroFallback />}</div>

        <div className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-bold text-white"><Radio size={14} className="text-coral" /> {t("home.liveNow")}</p>
            <Link to="/live" className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-lime hover:underline">{t("home.all")} <ArrowRight size={12} /></Link>
          </div>
          <div className="flex-1 px-4">
            {(data.live || []).length ? (
              (data.live || []).slice(0, 4).map((match, index) => <CompactMatchRow key={match._id} match={match} index={index} />)
            ) : (
              <div className="grid h-full min-h-[180px] place-items-center py-8 text-center">
                <div>
                  <Radio size={22} className="mx-auto mb-2 text-white/15" />
                  <p className="text-xs text-white/40">{t("home.noLive")}</p>
                  <Link to="/live" className="mt-2 inline-block text-[11px] font-semibold text-lime">{t("home.seeUpcoming")}</Link>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.06] p-3">
            <StatStrip counts={data.counts} />
          </div>
        </div>
      </section>

      {(data.live || []).length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">{t("home.onAir")}</p>
              <h2 className="section-title">{t("home.liveScoring")}</h2>
            </div>
            <Link to="/live" className="hidden text-xs font-semibold text-lime hover:underline sm:block">{t("home.fullScoreCentre")}</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.live.slice(0, 6).map((match) => <MatchCard key={match._id} match={match} />)}
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="eyebrow">{t("home.comingUp")}</p>
              <h2 className="section-title">{t("home.upcomingMatches")}</h2>
            </div>
            <Link to="/live" className="text-xs font-semibold text-lime hover:underline">{t("home.fixtures")}</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(data.upcoming || []).length ? data.upcoming.slice(0, 4).map((match) => <MatchCard key={match._id} match={match} />) : (
              <div className="sm:col-span-2"><EmptyState title={t("home.noFixtures")} text={t("home.noFixturesText")} /></div>
            )}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="eyebrow">{t("home.latest")}</p>
              <h2 className="section-title">{t("home.results")}</h2>
            </div>
            <Link to="/live?tab=finished" className="text-xs font-semibold text-lime hover:underline">{t("home.allResults")}</Link>
          </div>
          <div className="card divide-y divide-white/[0.05] px-4">
            {(data.recent || []).length ? data.recent.slice(0, 5).map((match, index) => <CompactMatchRow key={match._id} match={match} index={index} />) : (
              <p className="py-8 text-center text-xs text-white/35">{t("home.noResults")}</p>
            )}
          </div>
        </div>
      </section>

      {(data.shorts || []).length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="eyebrow">{t("home.shortSharp")}</p>
              <h2 className="section-title">{t("home.shorts")}</h2>
            </div>
            <Link to="/videos?type=short" className="text-xs font-semibold text-lime hover:underline">{t("home.allShorts")}</Link>
          </div>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {data.shorts.slice(0, 8).map((video) => (
              <VideoCard key={video._id} video={video} compact className="w-[210px] shrink-0 snap-start" />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="eyebrow">{t("home.watch")}</p>
              <h2 className="section-title">{t("home.highlightsReplays")}</h2>
            </div>
            <Link to="/videos" className="text-xs font-semibold text-lime hover:underline">{t("home.videoHub")}</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(data.highlights || []).length ? data.highlights.slice(0, 4).map((video) => <VideoCard key={video._id} video={video} />) : <div className="sm:col-span-2"><SkeletonCard /></div>}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="eyebrow">{t("home.competitions")}</p>
              <h2 className="section-title">{t("home.series")}</h2>
            </div>
            <CalendarDays size={16} className="text-white/25" />
          </div>
          <div className="card divide-y divide-white/[0.05]">
            {(data.series || []).length ? data.series.slice(0, 7).map((series) => (
              <Link key={series.name} to={`/live?series=${encodeURIComponent(series.name)}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime/10 text-[10px] font-bold text-lime">{series.matches}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white/80">{series.name}</p>
                  <p className="text-[10px] text-white/30">
                    {series.matches === 1 ? t("home.matchCountOne", { count: series.matches }) : t("home.matchCount", { count: series.matches })}
                    {" · "}{new Date(series.latest).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight size={13} className="text-white/20" />
              </Link>
            )) : <p className="py-8 text-center text-xs text-white/35">{t("home.noSeries")}</p>}
          </div>

          <Link to="/admin" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-lime/20 bg-lime/[0.05] p-4 transition hover:bg-lime/[0.09]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-lime">{t("home.scorerAccess")}</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{t("home.runMatch")}</p>
            </div>
            <ArrowRight size={16} className="text-lime" />
          </Link>
        </div>
      </section>

      <section className={cn("relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-r from-lime/[0.08] via-transparent to-mint/[0.06] p-6 sm:p-8")}>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">{t("home.builtForEveryLeague")}</p>
            <h2 className="mt-1 font-display text-2xl font-700 text-white">{t("home.scoreOnce")}</h2>
            <p className="mt-1 max-w-xl text-sm text-white/45">{t("home.scoreOnceText")}</p>
          </div>
          <Link to="/admin/login" className="btn-primary">{t("home.openAdmin")} <ArrowRight size={15} /></Link>
        </div>
      </section>
    </div>
  );
}
