import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Eye,
  MapPin,
  Radio,
  Share2,
  Trophy,
  Tv,
  Users,
} from "lucide-react";
import Scorecard from "../components/Scorecard";
import CommentaryFeed from "../components/CommentaryFeed";
import MatchPulse from "../components/MatchPulse";
import Squads from "../components/Squads";
import LiveChat from "../components/LiveChat";
import Reactions from "../components/Reactions";
import LiveVideoPlayer from "../components/LiveVideoPlayer";
import FloatingLivePlayer from "../components/FloatingLivePlayer";
import BallMoment from "../components/BallMoment";
import { WinProbability, WormChart, InsightTiles, PartnershipCard } from "../components/MatchInsights";
import { TeamLogo } from "../components/common/Avatars";
import { LiveBadge, StatusPill } from "../components/common/Badges";
import Tabs from "../components/common/Tabs";
import { EmptyState, ErrorState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useMatchView } from "../hooks/useMatchView";
import { useSocket, useSocketEvent } from "../contexts/SocketContext";
import { useToast } from "../contexts/ToastContext";
import { cn, chaseInfo, copyText, formatDateTime, formatNumber, matchViews, resultText, runRate, statusLabel, teamName, timeAgo } from "../lib/utils";

const tabs = [
  { key: "live", label: "Live centre" },
  { key: "scorecard", label: "Scorecard" },
  { key: "commentary", label: "Commentary" },
  { key: "squads", label: "Squads" },
  { key: "insights", label: "Insights" },
];

function TeamBlock({ team, innings, isBatting, isWinner, live }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <TeamLogo team={team} size="lg" ring={isBatting && live} />
      <div className="min-w-0">
        <p className={cn("truncate font-display text-base font-700 sm:text-lg", isWinner ? "text-lime" : "text-white")}>{teamName(team)}</p>
        <p className="truncate text-[11px] text-white/35">{team?.name}</p>
        {innings ? (
          <p className={cn("mt-0.5 font-mono text-2xl font-bold tabular-nums sm:text-3xl", isBatting && live ? "text-lime" : "text-white")}>
            {innings.runs}/{innings.wickets}
            <span className="ml-1.5 text-[11px] font-medium text-white/35">({innings.overs})</span>
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-white/25">Yet to bat</p>
        )}
      </div>
    </div>
  );
}

export default function MatchDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "live";
  const { data, loading, error, refetch, setData } = useFetch(`/api/matches/${id}`, { deps: [id], poll: 60000 });
  const { data: insightData, refetch: refetchInsights } = useFetch(`/api/stats/matches/${id}`, { deps: [id], poll: 30000 });
  const { joinMatch, leaveMatch, joinStream, leaveStream, connected } = useSocket();
  const { success, error: toastError } = useToast();
  const [watchers, setWatchers] = useState(0);
  const [copied, setCopied] = useState(false);
  const insightTimer = useRef(null);

  const match = data?.match;
  const insights = insightData?.insights;
  useMatchView(match);
  const chase = chaseInfo(match);
  const views = matchViews(match);

  useEffect(() => {
    if (!match) return undefined;
    joinMatch(match._id);
    if (match.stream?.isLive) joinStream(match._id);
    return () => {
      leaveMatch(match._id);
      leaveStream(match._id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?._id, match?.stream?.isLive]);

  useSocketEvent("match:update", (payload) => {
    if (!payload?.match || String(payload.match._id) !== String(id)) return;
    setData({ ...(payload.match ? { match: payload.match } : {}) });
    if (insightTimer.current) return;
    insightTimer.current = setTimeout(() => {
      insightTimer.current = null;
      refetchInsights(true);
    }, 900);
  });

  useSocketEvent("stream:update", ({ matchId, stream, match: summary }) => {
    if (String(matchId) !== String(id)) return;
    setData((current) => {
      if (!current?.match) return current;
      return { ...current, match: { ...current.match, stream: { ...current.match.stream, ...stream }, ...(summary ? { views: summary.views } : {}) } };
    });
  });

  useSocketEvent("stream:viewers", ({ matchId, viewers }) => {
    if (String(matchId) === String(id)) setWatchers(viewers);
  });

  useSocketEvent("match:presence", ({ matchId, watchers: count }) => {
    if (String(matchId) === String(id)) setWatchers(count);
  });

  useEffect(() => () => clearTimeout(insightTimer.current), []);

  const teamInnings = useMemo(() => {
    if (!match) return { A: null, B: null };
    const rows = match.innings || [];
    return {
      A: rows.find((row) => String(row.battingTeam?._id || row.battingTeam) === String(match.teamA?._id || match.teamA)) || null,
      B: rows.find((row) => String(row.battingTeam?._id || row.battingTeam) === String(match.teamB?._id || match.teamB)) || null,
    };
  }, [match]);

  const current = match?.innings?.[match.currentInnings];
  const live = ["live", "innings-break"].includes(match?.status);
  const battingSlot = current ? (String(current.battingTeam?._id || current.battingTeam) === String(match.teamA?._id) ? "A" : "B") : "";
  const winnerId = String(match?.result?.winner || "");

  const copy = async () => {
    const ok = await copyText(window.location.href);
    if (ok) {
      setCopied(true);
      success("Match link copied");
      setTimeout(() => setCopied(false), 1800);
    } else {
      toastError("Could not copy the link");
    }
  };

  if (loading && !match) return <PageLoader label="Loading the match centre…" />;
  if (error && !match) return <div className="container-x py-10"><ErrorState message={error} onRetry={() => refetch()} /></div>;
  if (!match) return null;

  const streamAvailable = Boolean(match.stream?.isLive || match.stream?.recordingUrl);
  const setTab = (value) => {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    setParams(next, { replace: true });
  };

  return (
    <div className="container-x py-5 sm:py-7">
      <Link to="/live" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-white/40 transition hover:text-lime">
        <ArrowLeft size={13} /> Back to scores
      </Link>

      <div className="card relative overflow-hidden">
        <span className={cn("absolute inset-x-0 top-0 h-0.5", live ? "bg-gradient-to-r from-transparent via-coral to-transparent" : "bg-gradient-to-r from-transparent via-lime/50 to-transparent")} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={match.status} />
            <span className="text-[11px] font-semibold text-white/55">{match.series}</span>
            <span className="text-[11px] text-white/25">·</span>
            <span className="text-[11px] text-white/35">{match.format} · Match {match.matchNumber}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-white/30">
            {connected && <span className="inline-flex items-center gap-1 text-mint"><span className="h-1.5 w-1.5 rounded-full bg-mint" /> realtime</span>}
            {(watchers > 0 || match.stream?.viewers > 0) && <span className="inline-flex items-center gap-1"><Users size={11} /> {formatNumber(watchers || match.stream?.viewers)}</span>}
            <span className="inline-flex items-center gap-1"><Eye size={11} /> {formatNumber(views)}</span>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <TeamBlock team={match.teamA} innings={teamInnings.A} isBatting={battingSlot === "A"} isWinner={winnerId === String(match.teamA?._id)} live={live} />
            <div className="hidden shrink-0 flex-col items-center sm:flex">
              <span className="font-display text-xs font-700 uppercase tracking-[0.2em] text-white/20">vs</span>
              {match.stream?.isLive && <LiveBadge className="mt-2" label="VIDEO" />}
            </div>
            <div className="h-px w-full bg-white/[0.06] sm:hidden" />
            <TeamBlock team={match.teamB} innings={teamInnings.B} isBatting={battingSlot === "B"} isWinner={winnerId === String(match.teamB?._id)} live={live} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1"><MapPin size={11} /> {match.venue}{match.city ? `, ${match.city}` : ""}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {formatDateTime(match.startTime)}</span>
            {match.toss?.text && <span>{match.toss.text}</span>}
          </div>

          {live && current ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-lime/15 bg-lime/[0.05] px-3 py-2 text-[11px]">
              <span className="font-bold text-lime">{teamName(current.battingTeam)} {current.runs}/{current.wickets} ({current.overs})</span>
              {chase ? (
                <span className="text-white/55">Need <b className="text-white/85">{chase.runsNeeded}</b> from <b className="text-white/85">{chase.ballsLeft}</b> balls ({chase.oversLeft} ov) · RRR {chase.requiredRate}</span>
              ) : (
                <span className="text-white/55">CRR {runRate(current.runs, current.balls)} · {Math.max(0, match.overs * 6 - current.balls)} balls left</span>
              )}
              {current.striker && (
                <span className="ml-auto hidden text-white/40 sm:block">
                  {current.striker.name} <span className="text-lime">*</span> · {current.nonStriker?.name || "—"}
                </span>
              )}
            </div>
          ) : match.status === "finished" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-lime/20 bg-lime/[0.06] px-3 py-2 text-[12px] font-semibold text-lime">
              <Trophy size={13} /> {resultText(match) || "Match finished"}
              {match.playerOfMatch?.name && <span className="text-[10px] font-normal text-white/45">· POM {match.playerOfMatch.name}</span>}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-white/40">
              {match.status === "upcoming" ? `Starts ${timeAgo(match.startTime)} · ${match.format} · ${match.overs} overs` : statusLabel(match.status)}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {match.stream?.isLive && match.stream?.slug && (
              <Link to={`/live/${match.stream.slug}`} className="btn-primary btn-xs"><Tv size={13} /> Watch live video</Link>
            )}
            {!match.stream?.isLive && match.stream?.recordingUrl && (
              <Link to={`/live/${match.stream.slug || match._id}`} className="btn-ghost btn-xs"><Tv size={13} /> Watch replay</Link>
            )}
            <button onClick={copy} className="btn-ghost btn-xs">{copied ? <Check size={13} className="text-mint" /> : <Share2 size={13} />} {copied ? "Copied" : "Share"}</button>
            <span className="chip !text-[10px]"><Radio size={10} className="text-lime" /> ball-by-ball live</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="min-w-0">
          {live && <div className="lg:hidden mb-4"><MatchPulse match={match} /></div>}

          <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />

          {tab === "live" && (
            <div className="space-y-4">
              <div className="hidden lg:block"><MatchPulse match={match} /></div>
              {current ? (
                <>
                  <InsightTiles match={match} insights={insights} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <WinProbability match={match} insights={insights} />
                    <div className="card p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Match pulse</p>
                      <div className="mt-2 space-y-2 text-[12px]">
                        <p className="flex items-center justify-between"><span className="text-white/40">Innings</span><span className="font-semibold text-white/80">{current.number + 1} of 2</span></p>
                        <p className="flex items-center justify-between"><span className="text-white/40">Overs bowled</span><span className="font-mono text-white/80">{current.overs} / {match.overs}</span></p>
                        <p className="flex items-center justify-between"><span className="text-white/40">Run rate</span><span className="font-mono text-white/80">{runRate(current.runs, current.balls)}</span></p>
                        <p className="flex items-center justify-between"><span className="text-white/40">Extras</span><span className="font-mono text-white/80">{Object.values(current.extras || {}).reduce((a, b) => a + Number(b || 0), 0)}</span></p>
                        <p className="flex items-center justify-between"><span className="text-white/40">Last 5 overs</span><span className="font-mono text-white/80">{insights?.last5Runs ?? "—"} runs</span></p>
                      </div>
                    </div>
                  </div>
                  <PartnershipCard insights={insights} />
                  <WormChart match={match} insights={insights} />
                </>
              ) : (
                <EmptyState icon={<Radio size={20} />} title="Match not started" text="Follow this page — the live centre switches on automatically when the first ball is bowled." />
              )}
            </div>
          )}

          {tab === "scorecard" && <Scorecard match={match} />}
          {tab === "commentary" && <CommentaryFeed match={match} />}
          {tab === "squads" && <Squads match={match} />}
          {tab === "insights" && (
            current ? (
              <div className="space-y-4">
                <InsightTiles match={match} insights={insights} />
                <WinProbability match={match} insights={insights} />
                <PartnershipCard insights={insights} />
                <WormChart match={match} insights={insights} />
                <div className="card p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">Recent overs</p>
                  <div className="flex flex-wrap gap-2">
                    {(insights?.last5Overs || []).map((over) => (
                      <div key={over.over} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-center">
                        <p className="text-[9px] text-white/30">OV {over.over}</p>
                        <p className="font-mono text-sm font-bold text-white/80">{over.runs}</p>
                        <p className="text-[9px] text-white/25">{over.wickets}W</p>
                      </div>
                    ))}
                    {!insights?.last5Overs?.length && <p className="text-xs text-white/35">No overs bowled yet.</p>}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={<Trophy size={20} />} title="Insights unlock at the first ball" />
            )
          )}
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-[104px] lg:self-start">
          {streamAvailable ? (
            <div>
              <LiveVideoPlayer match={match} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/40">
                  {match.stream?.isLive ? "Live from the ground" : "Match replay available"}
                </p>
                {match.stream?.isLive && match.stream?.slug && (
                  <Link to={`/live/${match.stream.slug}`} className="text-[11px] font-semibold text-lime hover:underline">Open live page →</Link>
                )}
              </div>
            </div>
          ) : (
            <div className="card relative overflow-hidden p-5">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lime/10 blur-2xl" />
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-lime"><Tv size={12} /> Video</p>
              <p className="mt-1 text-sm font-semibold text-white/80">No live video for this match</p>
              <p className="mt-1 text-[11px] text-white/35">When the host goes live from the admin console, the floating player will appear here automatically.</p>
              <Link to="/videos" className="btn-ghost btn-xs mt-3">Browse highlights</Link>
            </div>
          )}
          <Reactions matchId={match._id} />
          <LiveChat matchId={match._id} />
        </aside>
      </div>

      <FloatingLivePlayer match={match} />
      <BallMoment match={match} />
    </div>
  );
}
