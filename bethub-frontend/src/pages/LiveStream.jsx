import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Eye,
  MapPin,
  Radio,
  Share2,
  Tv,
  Users,
  WifiOff,
} from "lucide-react";
import LiveVideoPlayer from "../components/LiveVideoPlayer";
import FloatingLivePlayer from "../components/FloatingLivePlayer";
import BallMoment from "../components/BallMoment";
import MatchCard from "../components/MatchCard";
import Scorecard from "../components/Scorecard";
import CommentaryFeed from "../components/CommentaryFeed";
import LiveChat from "../components/LiveChat";
import Reactions from "../components/Reactions";
import Tabs from "../components/common/Tabs";
import { TeamLogo } from "../components/common/Avatars";
import { LiveBadge, StatusPill } from "../components/common/Badges";
import { EmptyState, ErrorState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useMatchView } from "../hooks/useMatchView";
import { useSocket, useSocketEvent } from "../contexts/SocketContext";
import { useToast } from "../contexts/ToastContext";
import { useI18n } from "../contexts/LanguageContext";
import { cn, chaseInfo, copyText, formatDateTime, formatNumber, matchViews, resultText, scoreSummary, teamName, timeAgo } from "../lib/utils";

function LiveStrip({ match, live }) {
  const scores = scoreSummary(match);
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <TeamLogo team={match.teamA} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{teamName(match.teamA)}</p>
          <p className="font-mono text-lg font-bold tabular-nums text-white">{scores.a || "—"}</p>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">vs</p>
        {live ? <LiveBadge className="mt-1" /> : <StatusPill status={match.status} />}
      </div>
      <div className="flex min-w-0 flex-row-reverse items-center gap-2.5 text-right">
        <TeamLogo team={match.teamB} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{teamName(match.teamB)}</p>
          <p className="font-mono text-lg font-bold tabular-nums text-white">{scores.b || "—"}</p>
        </div>
      </div>
    </div>
  );
}

export default function LiveStream() {
  const { t } = useI18n();
  const { slug } = useParams();
  const { data, loading, error, refetch, setData } = useFetch(slug ? `/api/streams/by-slug/${slug}` : "", {
    enabled: Boolean(slug),
    deps: [slug],
    poll: 60000,
  });
  const { data: liveData, loading: liveLoading } = useFetch("/api/streams/live", { poll: 45000 });
  const { joinMatch, leaveMatch, joinStream, leaveStream } = useSocket();
  const { success, error: toastError } = useToast();
  const [watchers, setWatchers] = useState(0);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("centre");
  const copyTimer = useRef(null);

  const tabs = [
    { key: "centre", label: t("live.tabCentre") },
    { key: "scorecard", label: t("live.tabScorecard") },
    { key: "commentary", label: t("live.tabCommentary") },
  ];

  const match = data?.match;
  const stream = match?.stream || {};
  const live = Boolean(stream.isLive);
  useMatchView(match);
  const chase = chaseInfo(match);
  const views = matchViews(match);

  useEffect(() => {
    if (!match?._id) return undefined;
    joinMatch(match._id);
    joinStream(match._id);
    return () => {
      leaveMatch(match._id);
      leaveStream(match._id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?._id]);

  useSocketEvent("match:update", (payload) => {
    if (!payload?.match || String(payload.match._id) !== String(match?._id)) return;
    setData((current) => (current ? { ...current, match: payload.match } : current));
  });

  useSocketEvent("stream:update", ({ matchId, stream: nextStream, match: summary }) => {
    if (String(matchId) !== String(match?._id)) return;
    setData((current) => {
      if (!current?.match) return current;
      return { ...current, match: { ...current.match, stream: { ...current.match.stream, ...nextStream }, ...(summary ? { views: summary.views } : {}) } };
    });
  });

  useSocketEvent("stream:viewers", ({ matchId, viewers }) => {
    if (String(matchId) === String(match?._id)) setWatchers(viewers);
  });

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const copy = async () => {
    const ok = await copyText(window.location.href);
    if (ok) {
      setCopied(true);
      success(t("live.copySuccess"));
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } else {
      toastError(t("live.copyError"));
    }
  };

  if (!slug) {
    const streams = liveData?.streams || [];
    return (
      <div className="container-x py-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow flex items-center gap-2"><Radio size={13} /> {t("live.desk")}</p>
            <h1 className="mt-1 font-display text-3xl font-700 tracking-tight text-white sm:text-4xl">{t("live.title")}</h1>
            <p className="mt-1 text-sm text-white/45">{t("live.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip !border-coral/20 !bg-coral/10 !text-coral"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-coral" /> {t("matches.liveCount", { count: streams.length })}</span>
            <Link to="/matches" className="btn-ghost btn-xs">{t("live.allMatches")}</Link>
          </div>
        </div>

        {liveLoading && !liveData ? (
          <PageLoader label={t("live.scanning")} />
        ) : streams.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {streams.map((row) => <MatchCard key={row._id} match={row} />)}
          </div>
        ) : (
          <EmptyState
            icon={<Radio size={20} />}
            title={t("live.none")}
            text={t("live.noneText")}
            action={<Link to="/matches" className="btn-primary btn-xs">{t("live.seeAll")}</Link>}
          />
        )}
      </div>
    );
  }

  if (loading && !match) return <PageLoader label={t("live.connecting")} />;
  if (error && !match) {
    return (
      <div className="container-x py-12">
        <ErrorState message={error} onRetry={() => refetch()} />
        <div className="mt-4 text-center">
          <Link to="/live" className="btn-ghost btn-xs">{t("live.browseAll")}</Link>
        </div>
      </div>
    );
  }
  if (!match) return null;

  const others = (liveData?.streams || []).filter((row) => row._id !== match._id).slice(0, 5);
  const watchCount = Math.max(watchers, stream.viewers || 0);

  return (
    <div className="container-x py-5 sm:py-7">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link to="/live" className="inline-flex items-center gap-1 text-xs font-medium text-white/40 transition hover:text-lime">
          <ArrowLeft size={13} /> {t("live.back")}
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={copy} className="btn-ghost btn-xs">
            {copied ? <Check size={13} className="text-mint" /> : <Share2 size={13} />} {copied ? t("live.copied") : t("live.share")}
          </button>
          <Link to={`/match/${match._id}`} className="btn-ghost btn-xs">{t("live.fullScorecard")}</Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {live ? <LiveBadge label={t("live.liveVideo")} /> : <span className="chip">{stream.recordingUrl ? t("live.replay") : t("live.video")}</span>}
                <span className="text-[11px] font-semibold text-white/55">{match.series}</span>
                <span className="text-[11px] text-white/25">·</span>
                <span className="text-[11px] text-white/35">{match.format} · {t("matchcard.matchNumber", { number: match.matchNumber })}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-white/35">
                {live && <span className="inline-flex items-center gap-1"><Users size={11} className="text-coral" /> {t("live.watching", { count: formatNumber(watchCount) })}</span>}
                <span className="inline-flex items-center gap-1"><Eye size={11} /> {t("live.views", { count: formatNumber(views) })}</span>
              </div>
            </div>

            <div className="bg-black">
              {live || stream.recordingUrl ? (
                <LiveVideoPlayer match={match} className="!rounded-none !border-0 !shadow-none" />
              ) : (
                <div className="grid aspect-video place-items-center p-6 text-center">
                  <div>
                    <WifiOff size={30} className="mx-auto mb-3 text-white/20" />
                    <p className="text-sm font-semibold text-white/70">{t("live.offline")}</p>
                    <p className="mt-1 max-w-sm text-xs text-white/35">
                      {match.status === "finished" ? t("live.finishedText") : t("live.soonText")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              <LiveStrip match={match} live={live} />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] pt-3 text-[11px] text-white/40">
                <span className="inline-flex items-center gap-1"><MapPin size={11} /> {match.venue}{match.city ? `, ${match.city}` : ""}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {formatDateTime(match.startTime)}</span>
              </div>
              {match.status === "finished" && (
                <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs text-white/55">
                  <span className="font-semibold text-white/75">{t("live.finished")}</span> · {resultText(match) || t("live.matchCompleted")}
                  {match.playerOfMatch?.name && <span className="text-white/35"> · {t("live.playerOfMatch", { name: match.playerOfMatch.name })}</span>}
                </p>
              )}
              {live && match.innings?.[match.currentInnings] && (
                <div className="space-y-1.5">
                  <p className="rounded-xl border border-lime/15 bg-lime/[0.05] px-3 py-2 text-[11px] text-white/60">
                    <span className="font-bold text-lime">{teamName(match.innings[match.currentInnings].battingTeam)} {match.innings[match.currentInnings].runs}/{match.innings[match.currentInnings].wickets}</span>{" "}
                    {t("live.afterOvers", { overs: match.innings[match.currentInnings].overs })}
                    {match.innings[match.currentInnings].striker && (
                      <span className="text-white/40"> · {t("live.onStrike", { name: match.innings[match.currentInnings].striker.name })}</span>
                    )}
                  </p>
                  {chase && (
                    <p className="rounded-xl border border-coral/20 bg-coral/[0.06] px-3 py-2 text-[11px] font-semibold text-coral">
                      {chase.equation} · {t("live.rrr", { rate: chase.requiredRate, overs: chase.oversLeft })}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          {tab === "centre" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{t("live.broadcast")}</p>
                <div className="mt-3 space-y-2 text-[12px]">
                  <p className="flex justify-between"><span className="text-white/40">{t("live.status")}</span><span className={cn("font-semibold", live ? "text-coral" : "text-white/70")}>{live ? t("live.liveNow") : stream.recordingUrl ? t("live.replayAvailable") : t("live.offlineStatus")}</span></p>
                  <p className="flex justify-between"><span className="text-white/40">{t("live.mode")}</span><span className="font-semibold uppercase text-white/70">{stream.mode || "—"}</span></p>
                  <p className="flex justify-between"><span className="text-white/40">{t("live.started")}</span><span className="text-white/70">{stream.startedAt ? timeAgo(stream.startedAt) : "—"}</span></p>
                  <p className="flex justify-between"><span className="text-white/40">{t("live.watchingLabel")}</span><span className="font-mono text-white/70">{formatNumber(watchCount)}</span></p>
                </div>
              </div>
              <div className="card flex flex-col justify-between gap-3 p-4">
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-lime"><Tv size={12} /> {t("live.onTheCall")}</p>
                  <p className="mt-2 text-sm font-semibold text-white/80">{match.teamA?.name} vs {match.teamB?.name}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/35">{match.toss?.text || t("live.defaultToss")}</p>
                </div>
                <Link to={`/match/${match._id}?tab=live`} className="btn-ghost btn-xs self-start"><Radio size={12} className="text-lime" /> {t("live.openCentre")}</Link>
              </div>
            </div>
          )}
          {tab === "scorecard" && <Scorecard match={match} />}
          {tab === "commentary" && <CommentaryFeed match={match} />}
        </div>

        <aside className="min-w-0 space-y-4">
          <Reactions matchId={match._id} />
          <LiveChat matchId={match._id} className="!h-[560px]" />

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-bold text-white"><Radio size={13} className="text-coral" /> {t("live.liveStreams")}</p>
              <Link to="/live" className="text-[10px] font-semibold text-lime hover:underline">{t("live.all")}</Link>
            </div>
            {others.length ? (
              <div className="divide-y divide-white/[0.05]">
                {others.map((row) => (
                  <Link key={row._id} to={`/live/${row.stream?.slug}`} className="flex items-center gap-2.5 px-4 py-2.5 transition hover:bg-white/[0.03]">
                    <TeamLogo team={row.teamA} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-white/80">{row.teamA?.shortName} vs {row.teamB?.shortName}</p>
                      <p className="text-[9px] text-white/35">{t("live.watching", { count: formatNumber(row.stream?.viewers || 0) })}</p>
                    </div>
                    <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-coral" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center">
                <EmptyState icon={<Tv size={18} />} title={t("live.otherNone")} text={t("live.otherNoneText")} />
              </div>
            )}
          </div>
        </aside>
      </div>

      <FloatingLivePlayer match={match} />
      <BallMoment match={match} />
    </div>
  );
}
