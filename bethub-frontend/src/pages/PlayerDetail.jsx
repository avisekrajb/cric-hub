import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Ruler,
  Star,
  Trophy,
  UserRound,
} from "lucide-react";
import { CountryFlag, PlayerAvatar, TeamLogo } from "../components/common/Avatars";
import { ErrorState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useI18n } from "../contexts/LanguageContext";
import { battingStyleLabel, bowlingStyleLabel, formatDate, oversOf, resultText, roleLabel, teamName, timeAgo } from "../lib/utils";

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">{label}</p>
      <p className="mt-0.5 font-display text-xl font-700 tabular-nums text-white">{value}</p>
      {hint && <p className="text-[9px] text-white/30">{hint}</p>}
    </div>
  );
}

export default function PlayerDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data, loading, error, refetch } = useFetch(`/api/stats/players/${id}`, { deps: [id] });
  const { data: profileData } = useFetch(`/api/players/${id}`, { deps: [id] });

  const player = data?.player || profileData?.player;
  const stats = data?.stats;
  const matches = data?.matches || [];
  const teams = profileData?.teams || [];

  if (loading && !player) return <PageLoader label={t("playerDetail.loading")} />;
  if (error && !player) return <div className="container-x py-10"><ErrorState message={error} onRetry={() => refetch()} /></div>;
  if (!player) return null;

  const age = player.dateOfBirth
    ? Math.floor((Date.now() - new Date(player.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const batting = stats?.batting || {};
  const bowling = stats?.bowling || {};

  return (
    <div className="container-x py-5 sm:py-7">
      <Link to="/players" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-white/40 transition hover:text-lime">
        <ArrowLeft size={13} /> {t("playerDetail.back")}
      </Link>

      <div className="card relative overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-lime/15 via-mint/5 to-transparent sm:h-32" />
        <div className="relative px-4 pb-5 sm:px-6">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <PlayerAvatar player={player} size="xl" className="border-4 border-ink-950 shadow-card" />
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-700 tracking-tight text-white sm:text-3xl">
                {player.name}
                {player.isCaptain && <span className="rounded bg-lime/15 px-1.5 py-0.5 text-[10px] font-bold text-lime">C</span>}
                {player.isWicketkeeper && <span className="rounded bg-sky/15 px-1.5 py-0.5 text-[10px] font-bold text-sky">WK</span>}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
                <span className="font-semibold text-white/65">{roleLabel(player.role, t)}</span>
                <span className="inline-flex items-center gap-1"><CountryFlag country={player.country} /> {player.country?.name}</span>
                {player.jerseyNumber && <span className="font-mono">#{player.jerseyNumber}</span>}
                {player.height && <span className="inline-flex items-center gap-1"><Ruler size={11} /> {player.height}</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {(teams.length ? teams : []).map((team) => (
                <Link key={team._id} to={`/teams/${team._id}`} className="chip hover:!border-lime/30 hover:!text-lime">
                  <TeamLogo team={team} size="xs" className="!h-4 !w-4 !rounded" /> {team.shortName}
                </Link>
              ))}
              {player.birthplace && <span className="chip"><MapPin size={10} /> {player.birthplace}</span>}
            </div>
          </div>
          {player.bio && <p className="mt-4 max-w-3xl border-t border-white/[0.06] pt-3 text-sm leading-relaxed text-white/50">{player.bio}</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold text-white"><SpanIcon /> {t("playerDetail.batting")}</p>
            <span className="text-[10px] text-white/30">{t("playerDetail.innings", { count: batting.innings || 0 })}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label={t("playerDetail.runs")} value={batting.runs || 0} hint={t("playerDetail.hs", { n: batting.highScore || 0 })} />
            <StatTile label={t("playerDetail.average")} value={batting.average ?? "0"} hint={t("playerDetail.notOuts", { count: batting.notOuts || 0 })} />
            <StatTile label={t("playerDetail.strikeRate")} value={batting.strikeRate ?? "0"} hint={t("playerDetail.ballsCount", { count: batting.balls || 0 })} />
            <StatTile label={t("playerDetail.fours")} value={batting.fours || 0} />
            <StatTile label={t("playerDetail.sixes")} value={batting.sixes || 0} />
            <StatTile label={t("playerDetail.balls")} value={batting.balls || 0} />
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold text-white"><Trophy size={14} className="text-lime" /> {t("playerDetail.bowling")}</p>
            <span className="text-[10px] text-white/30">{t("playerDetail.overs", { n: oversOf(bowling.balls) })}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label={t("playerDetail.wickets")} value={bowling.wickets || 0} hint={t("playerDetail.best", { n: bowling.best || 0 })} />
            <StatTile label={t("playerDetail.economy")} value={bowling.economy ?? "0"} hint={t("playerDetail.runsCount", { count: bowling.runs || 0 })} />
            <StatTile label={t("playerDetail.average")} value={bowling.average ?? "0"} hint={t("playerDetail.runsPerWicket")} />
            <StatTile label={t("playerDetail.strikeRate")} value={bowling.strikeRate ?? "0"} hint={t("playerDetail.ballsPerWicket")} />
            <StatTile label={t("playerDetail.maidens")} value={bowling.maidens || 0} />
            <StatTile label={t("playerDetail.oversWord")} value={oversOf(bowling.balls)} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="eyebrow">{t("playerDetail.recentForm")}</p>
              <h2 className="section-title">{t("playerDetail.lastMatches")}</h2>
            </div>
            <CalendarDays size={16} className="text-white/25" />
          </div>
          <div className="card divide-y divide-white/[0.05]">
            {matches.length ? matches.map((match) => {
              const performance = match.performance || {};
              return (
                <Link key={match._id} to={`/match/${match._id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                  <div className="flex shrink-0 -space-x-1.5">
                    <TeamLogo team={match.teamA} size="xs" />
                    <TeamLogo team={match.teamB} size="xs" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white/80">{match.teamA?.shortName} {t("detail.vs")} {match.teamB?.shortName}</p>
                    <p className="truncate text-[10px] text-white/35">{match.series} · {timeAgo(match.startTime)}</p>
                    <p className="truncate text-[10px] text-lime/70">{resultText(match)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-xs font-bold text-white/85">{performance.runs || 0}<span className="text-[9px] text-white/35"> ({performance.balls || 0})</span></p>
                    <p className="text-[9px] text-white/40">{performance.wickets || 0}W · {performance.bowlingRuns || 0}R</p>
                  </div>
                </Link>
              );
            }) : <p className="px-4 py-8 text-center text-xs text-white/35">{t("playerDetail.noMatches")}</p>}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{t("playerDetail.profile")}</p>
            <div className="mt-3 space-y-2 text-[12px]">
              <p className="flex justify-between gap-3"><span className="text-white/40">{t("playerDetail.role")}</span><span className="text-right font-semibold text-white/75">{roleLabel(player.role, t)}</span></p>
              <p className="flex justify-between gap-3"><span className="text-white/40">{t("playerDetail.battingStyle")}</span><span className="text-right text-white/70">{battingStyleLabel(player.battingStyle, t) || "—"}</span></p>
              <p className="flex justify-between gap-3"><span className="text-white/40">{t("playerDetail.bowlingStyle")}</span><span className="text-right text-white/70">{bowlingStyleLabel(player.bowlingStyle, t) || "—"}</span></p>
              <p className="flex justify-between gap-3"><span className="text-white/40">{t("playerDetail.born")}</span><span className="text-right text-white/70">{formatDate(player.dateOfBirth)}{age != null ? ` · ${t("playerDetail.years", { n: age })}` : ""}</span></p>
              <p className="flex justify-between gap-3"><span className="text-white/40">{t("playerDetail.birthplace")}</span><span className="text-right text-white/70">{player.birthplace || "—"}</span></p>
              <p className="flex justify-between gap-3"><span className="text-white/40">{t("playerDetail.jersey")}</span><span className="text-right font-mono text-white/70">{player.jerseyNumber ?? "—"}</span></p>
            </div>
          </div>
          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-lime"><Star size={12} /> {t("playerDetail.career")}</p>
            <p className="mt-2 font-display text-2xl font-700 text-white">{batting.runs || 0} <span className="text-xs font-normal text-white/35">{t("playerDetail.runsWord")}</span></p>
            <p className="text-[11px] text-white/40">{t("playerDetail.careerLine", { fours: batting.fours || 0, sixes: batting.sixes || 0, wickets: bowling.wickets || 0 })}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {teams.map((team) => (
                <Link key={team._id} to={`/teams/${team._id}`} className="chip hover:!text-lime">{teamName(team)}</Link>
              ))}
            </div>
          </div>
          <Link to="/stats" className="flex items-center justify-between rounded-xl border border-lime/20 bg-lime/[0.05] px-4 py-3 text-xs font-semibold text-lime transition hover:bg-lime/[0.09]">
            <span className="inline-flex items-center gap-2"><UserRound size={13} /> {t("playerDetail.leaderboards")}</span>
            <ArrowRight size={14} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function SpanIcon() {
  return <Trophy size={14} className="text-lime" />;
}
