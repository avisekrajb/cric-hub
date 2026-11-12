import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Shield,
  Trophy,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import { CountryFlag, PlayerAvatar, TeamLogo } from "../components/common/Avatars";
import { EmptyState, ErrorState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useI18n } from "../contexts/LanguageContext";
import { battingStyleLabel, cn, playerName, resultText, roleLabel, scoreSummary, timeAgo } from "../lib/utils";

const roleOrder = ["Batter", "Wicket-Keeper", "All-Rounder", "Bowler"];

export default function TeamDetail() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data, loading, error, refetch } = useFetch(`/api/teams/${id}`, { deps: [id] });
  const team = data?.team;
  const matches = data?.matches || [];

  if (loading && !team) return <PageLoader label={t("teamDetail.loading")} />;
  if (error && !team) return <div className="container-x py-10"><ErrorState message={error} onRetry={() => refetch()} /></div>;
  if (!team) return null;

  const players = team.players || [];
  const grouped = roleOrder
    .map((role) => ({ role, rows: players.filter((player) => player.role === role) }))
    .filter((group) => group.rows.length);
  const others = players.filter((player) => !roleOrder.includes(player.role));
  if (others.length) grouped.push({ role: "Squad", rows: others });

  const record = matches.reduce(
    (acc, match) => {
      if (match.status !== "finished") return acc;
      const winnerId = String(match.result?.winner || "");
      if (!winnerId) acc.other += 1;
      else if (winnerId === String(team._id)) acc.won += 1;
      else acc.lost += 1;
      return acc;
    },
    { won: 0, lost: 0, other: 0 }
  );

  return (
    <div className="container-x py-5 sm:py-7">
      <Link to="/teams" className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-white/40 transition hover:text-lime">
        <ArrowLeft size={13} /> {t("teamDetail.back")}
      </Link>

      <div className="card relative overflow-hidden">
        <div className="h-24 sm:h-32" style={{ background: `linear-gradient(120deg, ${team.color || "#00e28a"}33, transparent 60%)` }} />
        <div className="relative px-4 pb-5 sm:px-6">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <TeamLogo team={team} size="xl" className="border-4 border-ink-950" />
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-700 tracking-tight text-white sm:text-3xl">{team.name}</h1>
                <span className="chip">{team.shortName}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-white/40"><CountryFlag country={team.country} /> {team.country?.name}</span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/40">
                {team.homeGround && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {team.homeGround}</span>}
                {team.coach && <span className="inline-flex items-center gap-1"><UserCog size={11} /> {t("teamDetail.coach", { name: team.coach })}</span>}
                <span className="inline-flex items-center gap-1"><Users size={11} /> {t("teamDetail.players", { count: players.length })}</span>
              </p>
            </div>
            <div className="flex gap-2 pb-1">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-center">
                <p className="font-display text-xl font-700 text-lime">{record.won}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t("teamDetail.won")}</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-center">
                <p className="font-display text-xl font-700 text-white/75">{record.lost}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t("teamDetail.lost")}</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-center">
                <p className="font-display text-xl font-700 text-white/75">{record.other}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{t("teamDetail.other")}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.06] pt-3 text-[11px]">
            <span className="rounded-lg bg-white/[0.03] px-3 py-1.5 text-white/55"><Shield size={11} className="mr-1 inline text-lime" /> {t("teamDetail.captain")} <b className="text-white/85">{team.captain?.name || t("teamDetail.tbc")}</b></span>
            <span className="rounded-lg bg-white/[0.03] px-3 py-1.5 text-white/55"><UserRound size={11} className="mr-1 inline text-sky" /> {t("teamDetail.keeper")} <b className="text-white/85">{team.wicketkeeper?.name || t("teamDetail.tbc")}</b></span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">{t("teamDetail.dressingRoom")}</p>
              <h2 className="section-title">{t("teamDetail.squad")}</h2>
            </div>
            <span className="text-[11px] text-white/35">{t("teamDetail.registered", { count: players.length })}</span>
          </div>

          {players.length ? (
            grouped.map((group) => (
              <div key={group.role} className="card overflow-hidden">
                <p className="border-b border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-lime">{group.role === "Squad" ? t("teamDetail.squadRole") : roleLabel(group.role, t)}</p>
                <div className="divide-y divide-white/[0.04]">
                  {group.rows.map((player) => (
                    <Link key={player._id} to={`/players/${player._id}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.03]">
                      <PlayerAvatar player={player} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-white/85">
                          {playerName(player)}
                          {player.isCaptain && <span className="rounded bg-lime/15 px-1 text-[8px] font-bold text-lime">C</span>}
                          {player.isWicketkeeper && <span className="rounded bg-sky/15 px-1 text-[8px] font-bold text-sky">WK</span>}
                        </p>
                        <p className="truncate text-[10px] text-white/35">{battingStyleLabel(player.battingStyle, t) || roleLabel(player.role, t)} · {player.country?.name || ""}</p>
                      </div>
                      <span className="text-[10px] text-white/30">{player.jerseyNumber ? `#${player.jerseyNumber}` : ""}</span>
                      <ArrowRight size={12} className="text-white/20" />
                    </Link>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={<Users size={20} />} title={t("teamDetail.noPlayers")} text={t("teamDetail.noPlayersText")} />
          )}
        </div>

        <aside className="space-y-4">
          <div>
            <p className="eyebrow">{t("teamDetail.recent")}</p>
            <h2 className="section-title">{t("teamDetail.matches")}</h2>
          </div>
          <div className="card divide-y divide-white/[0.05]">
            {matches.length ? matches.map((match) => {
              const isA = String(match.teamA?._id || match.teamA) === String(team._id);
              const opponentId = isA ? match.teamB : match.teamA;
              const score = scoreSummary(match);
              return (
                <Link key={match._id} to={`/match/${match._id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-white/35"><Trophy size={15} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white/80">{t("teamDetail.vs", { team: typeof opponentId === "object" ? opponentId?.shortName : t("teamDetail.tbc") })}</p>
                    <p className="truncate text-[10px] text-white/35">{match.series} · {timeAgo(match.startTime)}</p>
                    {match.status === "finished" && <p className="truncate text-[10px] text-lime/70">{resultText(match)} · {isA ? score.a : score.b}</p>}
                  </div>
                  <span className={cn("shrink-0 text-[9px] font-bold uppercase", match.status === "live" ? "text-coral" : "text-white/30")}>{t(`status.${match.status === "innings-break" ? "inningsBreak" : match.status}`)}</span>
                </Link>
              );
            }) : (
              <p className="px-4 py-8 text-center text-xs text-white/35">{t("teamDetail.noMatches")}</p>
            )}
          </div>
          <Link to={`/live?team=${team._id}`} className="flex items-center justify-between rounded-xl border border-lime/15 bg-lime/[0.05] px-4 py-3 text-xs font-semibold text-lime transition hover:bg-lime/[0.09]">
            <span className="inline-flex items-center gap-2"><CalendarDays size={13} /> {t("teamDetail.seeAllFixtures")}</span>
            <ArrowRight size={14} />
          </Link>
          <div className="card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">{t("teamDetail.homeColours")}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg ring-1 ring-white/15" style={{ background: team.color || "#00e28a" }} />
              <span className="font-mono text-xs text-white/55">{team.color || "#00e28a"}</span>
              <TeamLogo team={team} size="sm" className="ml-auto" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
