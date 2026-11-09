import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Eye, MapPin, Play, Radio } from "lucide-react";
import { TeamLogo } from "./common/Avatars";
import { LiveBadge, StatusPill } from "./common/Badges";
import { useI18n } from "../contexts/LanguageContext";
import { cn, chaseInfo, formatNumber, matchViews, resultText, runRate, scoreSummary, teamName, timeAgo } from "../lib/utils";

const statusKeys = {
  live: "status.live",
  "innings-break": "status.inningsBreak",
  finished: "status.finished",
  upcoming: "status.upcoming",
  abandoned: "status.abandoned",
};

function TeamRow({ team, score, isBatting, isWinner, live }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3">
      <TeamLogo team={team} size="sm" />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", isWinner ? "text-lime" : "text-white/90")}>
          {teamName(team)}
          {isWinner && <span className="ml-1.5 text-[10px] font-bold uppercase text-lime/70">{t("matchcard.won")}</span>}
        </p>
      </div>
      <div className="text-right">
        <p className={cn("font-mono text-base font-bold tabular-nums", isBatting && live ? "text-lime" : "text-white")}>
          {score || "—"}
        </p>
      </div>
      {isBatting && live && <span className="h-1.5 w-1.5 shrink-0 animate-pulseDot rounded-full bg-lime" />}
    </div>
  );
}

export default function MatchCard({ match, variant = "default", className = "" }) {
  const { t } = useI18n();
  if (!match) return null;
  const scores = scoreSummary(match);
  const live = ["live", "innings-break"].includes(match.status);
  const current = match.innings?.[match.currentInnings];
  const battingTeamId = String(current?.battingTeam?._id || current?.battingTeam || "");
  const aBatting = battingTeamId && battingTeamId === String(match.teamA?._id || match.teamA);
  const bBatting = battingTeamId && battingTeamId === String(match.teamB?._id || match.teamB);
  const winnerId = String(match.result?.winner || "");
  const result = resultText(match);
  const chase = chaseInfo(match);
  const views = matchViews(match);
  const href = match.stream?.isLive && match.stream?.slug ? `/live/${match.stream.slug}` : `/match/${match._id}`;

  if (variant === "hero") {
    return (
      <Link to={href} className={cn("group relative block overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-900 shadow-card", className)}>
        {match.stream?.thumbnail && (
          <img src={match.stream.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 transition duration-700 group-hover:scale-105 group-hover:opacity-35" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-ink-950/85 to-ink-950/40" />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.35fr_1fr] lg:p-8">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <LiveBadge />
              <span className="chip !text-white/60">{match.series}</span>
              <span className="chip">{match.format} · {match.overs} ov</span>
            </div>
            <p className="eyebrow mb-1">
              {t("matchcard.featured")} · {match.matchNumber ? t("matchcard.matchNumber", { number: match.matchNumber }) : t("matchcard.liveNow")}
            </p>
            <h2 className="font-display text-3xl font-700 leading-tight text-white sm:text-4xl">
              {match.teamA?.name} <span className="text-white/30">vs</span> {match.teamB?.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/45">
              <span className="inline-flex items-center gap-1"><MapPin size={12} /> {match.venue}{match.city ? `, ${match.city}` : ""}</span>
            </p>

            <div className="mt-5 space-y-2.5 rounded-2xl border border-white/[0.07] bg-black/25 p-4 backdrop-blur">
              <TeamRow team={match.teamA} score={scores.a} isBatting={aBatting} isWinner={winnerId && winnerId === String(match.teamA?._id)} live={live} />
              <TeamRow team={match.teamB} score={scores.b} isBatting={bBatting} isWinner={winnerId && winnerId === String(match.teamB?._id)} live={live} />
              {current && (
                <p className="pt-1 text-[11px] text-white/40">
                  {current.striker?.name || "—"} <span className="text-white/25">*</span> {current.striker ? `${current.runs}/${current.wickets}` : ""} · CRR {runRate(current.runs, current.balls)}
                  {chase ? ` · ${chase.equation}` : current.target ? ` · need ${Math.max(0, current.target - current.runs)}` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div className="rounded-2xl border border-lime/20 bg-lime/[0.06] p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-lime"><Radio size={12} /> {t("matchcard.liveVideo")}</p>
              <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-white">{match.stream?.title || t("matchcard.watchTheMatch")}</p>
              <p className="mt-1 flex items-center gap-3 text-[11px] text-white/45">
                <span className="inline-flex items-center gap-1"><Eye size={11} /> {t("matchcard.watching", { count: formatNumber(match.stream?.viewers || 0) })}</span>
                <span>{t("matchcard.views", { count: formatNumber(views) })}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="btn-primary flex-1"><Play size={15} fill="currentColor" /> {t("matchcard.watchLive")}</span>
              <span className="btn-ghost"><ArrowUpRight size={15} /></span>
            </div>
            <p className="text-[11px] text-white/35">{t("matchcard.commentaryInside")}</p>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={href} className={cn("card card-hover group block p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={cn("truncate text-[10px] font-semibold uppercase tracking-[0.12em]", live ? "text-lime/80" : "text-white/35")}>
          {match.series}
        </span>
        <StatusPill status={match.status} />
      </div>

      <div className="space-y-2.5">
        <TeamRow team={match.teamA} score={scores.a} isBatting={aBatting} isWinner={winnerId && winnerId === String(match.teamA?._id)} live={live} />
        <TeamRow team={match.teamB} score={scores.b} isBatting={bBatting} isWinner={winnerId && winnerId === String(match.teamB?._id)} live={live} />
      </div>

      <div className="mt-3 border-t border-white/[0.06] pt-2.5">
        {live ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] text-white/45">
                {current ? `${current.overs} ov · CRR ${runRate(current.runs, current.balls)}` : t("matchcard.inProgress")}
              </p>
              {match.stream?.isLive ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-coral"><Radio size={11} /> {t("matchcard.video")}</span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-lime">{t("matchcard.live")} <ArrowUpRight size={11} /></span>
              )}
            </div>
            {chase && (
              <p className="truncate rounded-lg bg-lime/[0.08] px-2 py-1 text-[10px] font-semibold text-lime">
                {chase.equation} · RRR {chase.requiredRate}
              </p>
            )}
            <p className="flex items-center gap-1 text-[10px] text-white/30"><Eye size={10} /> {t("matchcard.views", { count: formatNumber(views) })}</p>
          </div>
        ) : match.status === "finished" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-medium text-white/55">{result || t("matchcard.matchFinished")}</p>
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-white/30"><Eye size={10} /> {formatNumber(views)}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1 truncate"><CalendarDays size={11} /> {timeAgo(match.startTime)}</span>
            <span className="inline-flex shrink-0 items-center gap-1 gap-x-2">{match.format} · {match.overs} ov <Eye size={10} /> {formatNumber(views)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export function CompactMatchRow({ match, index }) {
  const { t } = useI18n();
  const scores = scoreSummary(match);
  const live = ["live", "innings-break"].includes(match.status);
  return (
    <Link to={`/match/${match._id}`} className="group flex items-center gap-3 border-b border-white/[0.05] py-3 last:border-0">
      <span className="w-5 shrink-0 text-[10px] font-bold text-white/25">{String(index + 1).padStart(2, "0")}</span>
      <div className="flex shrink-0 -space-x-1.5">
        <TeamLogo team={match.teamA} size="xs" />
        <TeamLogo team={match.teamB} size="xs" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-white/85 group-hover:text-lime">
          {match.teamA?.shortName} vs {match.teamB?.shortName}
        </p>
        <p className="flex items-center gap-1 truncate text-[10px] text-white/35">
          <span className="truncate">{match.series}</span>
          <span>·</span>
          <Eye size={9} /> {formatNumber(matchViews(match))}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-xs font-bold text-white/85">{scores.a} <span className="text-white/25">·</span> {scores.b}</p>
        <p className={cn("text-[9px] font-bold uppercase tracking-wider", live ? "text-coral" : "text-white/30")}>
          {t(statusKeys[match.status] || "status.upcoming")}
        </p>
      </div>
    </Link>
  );
}
