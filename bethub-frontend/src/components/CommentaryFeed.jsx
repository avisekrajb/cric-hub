import { useEffect, useMemo, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { PlayerAvatar } from "./common/Avatars";
import { useI18n } from "../contexts/LanguageContext";
import { api } from "../lib/api";
import { cn, formatTime, oversOf } from "../lib/utils";

const labelFor = (ball) => {
  if (ball.wicket?.isWicket) return "W";
  if (ball.extraType === "wide") return "Wd";
  if (ball.extraType === "noBall") return "Nb";
  if (ball.extraType === "bye") return "B";
  if (ball.extraType === "legBye") return "Lb";
  return String(ball.batRuns ?? 0);
};

export default function CommentaryFeed({ match }) {
  const { t } = useI18n();
  const [balls, setBalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const updatedAt = match?.updatedAt;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api(`/api/matches/${match._id}/balls?limit=90`)
        .then((data) => {
          if (active) setBalls(data.balls || []);
        })
        .catch(() => {})
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [match._id, updatedAt]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const ball of balls) {
      const key = `${ball.innings}-${ball.over}`;
      if (!map.has(key)) map.set(key, { innings: ball.innings, over: ball.over, balls: [] });
      map.get(key).balls.push(ball);
    }
    return [...map.values()].sort((a, b) => b.innings - a.innings || b.over - a.over);
  }, [balls]);

  if (loading) {
    return <div className="card p-6 text-center text-xs text-white/35">{t("commentary.loading")}</div>;
  }

  if (!balls.length) {
    return (
      <div className="card flex flex-col items-center gap-2 p-10 text-center">
        <MessageSquareText size={22} className="text-white/20" />
        <p className="text-sm font-semibold text-white/60">{t("commentary.emptyTitle")}</p>
        <p className="max-w-xs text-xs text-white/35">{t("commentary.emptyText")}</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {groups.map((group) => (
        <div key={`${group.innings}-${group.over}`}>
          <div className="sticky top-16 z-10 flex items-center justify-between border-y border-white/[0.06] bg-ink-850/95 px-4 py-1.5 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
              {t("commentary.inningsOver", { innings: group.innings + 1, over: group.over })}
            </p>
            <p className="text-[10px] text-white/25">{t("commentary.deliveries", { count: group.balls.length })}</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {[...group.balls].reverse().map((ball) => {
              const label = labelFor(ball);
              const isBoundary = ["4", "6"].includes(label);
              const isWicket = label === "W";
              return (
                <div key={ball._id} className={cn("flex gap-3 px-4 py-3 transition hover:bg-white/[0.02]", isWicket && "bg-coral/[0.04]")}>
                  <span
                    className={cn(
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border font-mono text-[11px] font-bold",
                      isWicket
                        ? "border-coral/40 bg-coral/15 text-coral"
                        : isBoundary
                          ? "border-lime/40 bg-lime/10 text-lime"
                          : label.length > 1
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                            : "border-white/10 bg-white/[0.04] text-white/60"
                    )}
                  >
                    {label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px] leading-relaxed", isWicket ? "text-white" : "text-white/70")}>{ball.commentary}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-white/30">
                      <span>{ball.over}.{ball.ball}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <PlayerAvatar player={ball.batsman} size="xs" className="!h-3.5 !w-3.5 !text-[6px]" />
                        {ball.batsman?.name || t("commentary.batter")}
                      </span>
                      <span>·</span>
                      <span>{ball.bowler?.name || t("commentary.bowler")}</span>
                      <span>·</span>
                      <span>{t("commentary.score", { runs: ball.scoreAfter?.runs, wickets: ball.scoreAfter?.wickets, overs: ball.scoreAfter?.over })}</span>
                      <span className="ml-auto hidden sm:inline">{formatTime(ball.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="border-t border-white/[0.06] px-4 py-2.5 text-center text-[10px] text-white/25">
        {t("commentary.footer", { overs: oversOf(match?.innings?.[match.currentInnings]?.balls) })}
      </div>
    </div>
  );
}
