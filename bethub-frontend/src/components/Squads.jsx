import { Link } from "react-router-dom";
import { Shield, UserRound } from "lucide-react";
import { PlayerAvatar, TeamLogo } from "./common/Avatars";
import { useI18n } from "../contexts/LanguageContext";
import { battingStyleLabel, cn, roleLabel } from "../lib/utils";

function Squad({ team, rows = [], accent = "lime" }) {
  const { t } = useI18n();
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <TeamLogo team={team} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{team?.name}</p>
          <p className="text-[10px] text-white/35">{t("squads.inXI", { count: rows.length })} · {team?.homeGround || team?.country?.name || ""}</p>
        </div>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {rows.map((row, index) => {
          const player = row.player || {};
          return (
            <Link key={row.player?._id || index} to={`/players/${player._id}`} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.03]">
              <span className="w-4 text-[10px] font-bold text-white/25">{index + 1}</span>
              <PlayerAvatar player={player} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[12px] font-semibold text-white/85">
                  {player.name || t("squads.player")}
                  {row.isCaptain && <span className="rounded bg-lime/15 px-1 text-[8px] font-bold text-lime">C</span>}
                  {row.isKeeper && <span className="rounded bg-sky/15 px-1 text-[8px] font-bold text-sky">WK</span>}
                </p>
                <p className="text-[10px] text-white/35">{roleLabel(player.role, t) || t("squads.player")} · {battingStyleLabel(player.battingStyle, t) || "—"}</p>
              </div>
              {player.country?.flag?.url && (
                <img src={player.country.flag.url} alt={player.country.name} className="h-3 w-4 rounded-[1px] object-cover ring-1 ring-white/10" />
              )}
              <span className={cn("hidden text-[9px] sm:block", accent === "lime" ? "text-white/25" : "text-white/25")}>
                {player.jerseyNumber ? `#${player.jerseyNumber}` : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Squads({ match }) {
  const { t } = useI18n();
  const lineupA = match?.lineups?.A || [];
  const lineupB = match?.lineups?.B || [];
  if (!lineupA.length && !lineupB.length) {
    return (
      <div className="card flex flex-col items-center gap-2 p-10 text-center">
        <UserRound size={22} className="text-white/20" />
        <p className="text-sm font-semibold text-white/60">{t("squads.emptyTitle")}</p>
        <p className="text-xs text-white/35">{t("squads.emptyText")}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Squad team={match.teamA} rows={lineupA} />
      <Squad team={match.teamB} rows={lineupB} />
      <div className="lg:col-span-2 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] text-white/40">
        <span className="inline-flex items-center gap-1"><Shield size={12} className="text-lime" /> {t("squads.captain")}</span>
        <span className="inline-flex items-center gap-1"><span className="rounded bg-sky/15 px-1 text-[8px] font-bold text-sky">WK</span> {t("squads.keeper")}</span>
        <span className="ml-auto">{t("squads.tap")}</span>
      </div>
    </div>
  );
}
