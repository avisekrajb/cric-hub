import { PlayerAvatar } from "./common/Avatars";
import { cn, playerName, runRate } from "../lib/utils";

export default function MatchPulse({ match, className = "" }) {
  const innings = match?.innings?.[match.currentInnings];
  if (!innings) return null;
  const striker = innings.striker;
  const nonStriker = innings.nonStriker;
  const bowler = innings.bowler;
  const strikerLine = innings.batting?.find((row) => String(row.player?._id || row.player) === String(striker?._id || striker));
  const nonStrikerLine = innings.batting?.find((row) => String(row.player?._id || row.player) === String(nonStriker?._id || nonStriker));
  const bowlerLine = innings.bowling?.find((row) => String(row.player?._id || row.player) === String(bowler?._id || bowler));
  const over = innings.oversDetail?.at(-1);
  const balls = over?.balls || [];

  return (
    <div className={cn("card overflow-hidden", className)}>
      <div className="grid divide-y divide-white/[0.06] sm:grid-cols-[1.15fr_1fr] sm:divide-x sm:divide-y-0">
        <div className="p-3.5">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">At the crease</p>
          <div className="space-y-2.5">
            {[
              { player: striker, line: strikerLine, onStrike: true },
              { player: nonStriker, line: nonStrikerLine, onStrike: false },
            ].map(({ player, line, onStrike }) => (
              <div key={String(player?._id || player || onStrike)} className="flex items-center gap-2.5">
                <PlayerAvatar player={player} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={cn("flex items-center gap-1.5 truncate text-[13px] font-semibold", onStrike ? "text-lime" : "text-white/80")}>
                    {playerName(player)}
                    {onStrike && <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-lime" />}
                  </p>
                  <p className="text-[10px] text-white/35">{line ? `${line.runs} (${line.balls})` : "—"} · {player?.role || "Batter"}</p>
                </div>
                <div className="text-right text-[10px] text-white/40">
                  <p>SR {line?.balls ? ((line.runs / line.balls) * 100).toFixed(1) : "0.0"}</p>
                  <p>4s {line?.fours || 0} · 6s {line?.sixes || 0}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-2.5">
            <PlayerAvatar player={bowler} size="xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white/75">{playerName(bowler)}</p>
              <p className="text-[10px] text-white/35">{bowlerLine ? `${(bowlerLine.balls / 6).toFixed(1)} ov · ${bowlerLine.runs} runs · ${bowlerLine.wickets} wkt` : "Bowling"}</p>
            </div>
            <span className="chip !text-[9px]">bowling</span>
          </div>
        </div>

        <div className="p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">This over</p>
            <p className="text-[10px] text-white/35">CRR {runRate(innings.runs, innings.balls)}</p>
          </div>
          <div className="flex min-h-[34px] flex-wrap gap-1.5">
            {balls.length ? (
              balls.map((ball, index) => {
                const label = String(ball.label || ball.runs || "");
                const lower = label.toLowerCase();
                const isLast = index === balls.length - 1;
                const boundary = lower === "6" || lower === "4";
                const extra = lower.includes("wd") || lower.includes("nb");
                return (
                  <span
                    key={`${ball.over}-${ball.ball}-${index}`}
                    className={cn(
                      "grid h-8 min-w-8 place-items-center rounded-full border px-2 font-mono text-[11px] font-bold transition",
                      isLast && "animate-ball-pop",
                      ball.isWicket
                        ? "border-coral/40 bg-coral/15 text-coral"
                        : extra
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          : boundary
                            ? "border-lime/40 bg-lime/10 text-lime shadow-[0_0_18px_-4px_rgba(200,255,61,.55)]"
                            : "border-white/10 bg-white/[0.04] text-white/65"
                    )}
                  >
                    {ball.label || ball.runs}
                  </span>
                );
              })
            ) : (
              <span className="text-[11px] text-white/30">First ball coming up.</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {innings.freeHit && <span className="chip !border-amber-400/30 !bg-amber-400/10 !text-amber-300">FREE HIT</span>}
            {innings.needsBowler && <span className="chip !border-coral/30 !bg-coral/10 !text-coral">NEW BOWLER</span>}
            {innings.completed && <span className="chip">INNINGS COMPLETE</span>}
            {!innings.completed && (
              <span className="chip">
                {innings.wickets} down · {Math.max(0, (match.overs || 20) * 6 - innings.balls)} balls left
              </span>
            )}
          </div>
          {over?.bowler && (
            <p className="mt-2 truncate text-[10px] text-white/30">
              {over.bowler?.name || "Bowler"} · over {over.number} · {over.runs} runs
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
