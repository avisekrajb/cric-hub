import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ChevronRight, Wifi, WifiOff } from "lucide-react";
import { useFetch } from "../../hooks/useFetch";
import { useSocket, useSocketEvent } from "../../contexts/SocketContext";
import { useI18n } from "../../contexts/LanguageContext";
import { cn, scoreSummary } from "../../lib/utils";

export default function ScoreTicker() {
  const { data, refetch } = useFetch("/api/matches?status=live&limit=12", { poll: 25000 });
  const { connected } = useSocket();
  const { t } = useI18n();
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (data?.matches) setMatches(data.matches);
  }, [data]);

  useSocketEvent("score:update", ({ match }) => {
    if (!match) return;
    setMatches((rows) => {
      const exists = rows.some((row) => row._id === match._id);
      if (!exists) return [...rows, match];
      return rows.map((row) => (row._id === match._id ? match : row));
    });
  });

  useSocketEvent("notification", () => refetch(true));

  const items = matches.length ? matches : data?.matches || [];
  const doubled = [...items, ...items];

  return (
    <div className="border-b border-white/[0.06] bg-ink-900/60">
      <div className="container-x flex h-9 items-center gap-3 overflow-hidden">
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-lime">
          <Activity size={12} /> {t("ticker.liveDesk")}
        </span>
        <span className="h-3 w-px shrink-0 bg-white/10" />
        {connected ? (
          <span className="hidden shrink-0 items-center gap-1 text-[10px] text-mint sm:flex"><Wifi size={11} /> {t("ticker.realtime")}</span>
        ) : (
          <span className="hidden shrink-0 items-center gap-1 text-[10px] text-coral sm:flex"><WifiOff size={11} /> {t("ticker.reconnecting")}</span>
        )}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {items.length ? (
            <div className="flex w-max animate-ticker items-center gap-6 whitespace-nowrap hover:[animation-play-state:paused]">
              {doubled.map((match, index) => {
                const scores = scoreSummary(match);
                return (
                  <Link
                    key={`${match._id}-${index}`}
                    to={`/match/${match._id}`}
                    className="flex items-center gap-2 text-[11px] text-white/55 transition hover:text-white"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-coral" />
                    <span className="font-semibold text-white/85">{match.teamA?.shortName} vs {match.teamB?.shortName}</span>
                    <span className="font-mono text-white/70">
                      {match.teamA?.shortName} {scores.a || "—"} {scores.b ? `· ${match.teamB?.shortName} ${scores.b}` : ""}
                    </span>
                    {match.innings?.at(-1) && (
                      <span className="text-white/35">({match.innings.at(-1).overs} ov)</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <span className="flex items-center gap-2 text-[11px] text-white/35">
              <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-mint" : "bg-coral")} />
              {t("ticker.noLive")}
            </span>
          )}
        </div>
        <Link to="/live" className="hidden shrink-0 items-center gap-0.5 text-[10px] font-semibold text-lime hover:underline sm:flex">
          {t("ticker.allScores")} <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
