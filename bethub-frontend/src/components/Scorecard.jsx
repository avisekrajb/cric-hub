import { PlayerAvatar } from "./common/Avatars";
import { cn, oversOf, playerName, runRate, teamName } from "../lib/utils";

const findPlayer = (player, match) => {
  if (!player) return null;
  if (typeof player === "object" && player.name) return player;
  const id = String(player);
  for (const slot of ["A", "B"]) {
    const row = (match?.lineups?.[slot] || []).find((entry) => String(entry.player?._id || entry.player) === id);
    if (row?.player && typeof row.player === "object") return row.player;
  }
  return null;
};

function BattingTable({ innings, match }) {
  const rows = innings.batting || [];
  const strikerId = String(innings.striker?._id || innings.striker || "");
  const nonStrikerId = String(innings.nonStriker?._id || innings.nonStriker || "");
  const hasBat = new Set(rows.map((row) => String(row.player?._id || row.player)));
  const slot = String(innings.battingTeam?._id || innings.battingTeam) === String(match?.teamA?._id || match?.teamA) ? "A" : "B";
  const yetToBat = (match?.lineups?.[slot] || []).filter((row) => !hasBat.has(String(row.player?._id || row.player)));

  return (
    <div className="overflow-x-auto">
      <table className="table-base min-w-[520px]">
        <thead>
          <tr>
            <th>Batter</th>
            <th className="!text-right">R</th>
            <th className="!text-right">B</th>
            <th className="!text-right">4s</th>
            <th className="!text-right">6s</th>
            <th className="!text-right">SR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const player = findPlayer(row.player, match);
            const isStriker = String(row.player?._id || row.player) === strikerId;
            const isNonStriker = String(row.player?._id || row.player) === nonStrikerId;
            return (
              <tr key={String(row.player?._id || row.player) + row.position} className={cn(!row.out && "bg-lime/[0.03]")}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar player={player} size="xs" />
                    <div className="min-w-0">
                      <p className={cn("flex items-center gap-1.5 text-[13px] font-semibold", isStriker ? "text-lime" : "text-white/90")}>
                        {playerName(player)}
                        {isStriker && <span className="text-lime">*</span>}
                        {isNonStriker && <span className="text-[9px] text-white/30">non-striker</span>}
                      </p>
                      <p className="max-w-[280px] truncate text-[10px] text-white/35">
                        {row.out ? row.dismissal?.text || "out" : isStriker || isNonStriker ? "batting" : "not out"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="!text-right font-mono font-bold text-white">{row.runs}</td>
                <td className="!text-right font-mono text-white/55">{row.balls}</td>
                <td className="!text-right font-mono text-white/55">{row.fours}</td>
                <td className="!text-right font-mono text-white/55">{row.sixes}</td>
                <td className="!text-right font-mono text-white/55">{row.balls ? ((row.runs / row.balls) * 100).toFixed(1) : "0.0"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/45">
        <p>
          <span className="font-semibold text-white/60">Extras</span> {Object.values(innings.extras || {}).reduce((a, b) => a + (Number(b) || 0), 0)} ·{" "}
          {Object.entries(innings.extras || {}).filter(([, value]) => value).map(([key, value]) => `${key} ${value}`).join(", ") || "none"}
        </p>
        <p>
          <span className="font-semibold text-white/60">Total</span> {innings.runs}/{innings.wickets} ({innings.overs} ov) · RR {runRate(innings.runs, innings.balls)}
        </p>
      </div>
      {yetToBat.length > 0 && (
        <div className="mt-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/30">Yet to bat</p>
          <p className="mt-0.5 text-[11px] text-white/45">
            {yetToBat.map((row) => playerName(findPlayer(row.player, match))).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

function BowlingTable({ innings, match }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <p className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Bowling</p>
      <table className="table-base min-w-[480px]">
        <thead>
          <tr>
            <th>Bowler</th>
            <th className="!text-right">O</th>
            <th className="!text-right">M</th>
            <th className="!text-right">R</th>
            <th className="!text-right">W</th>
            <th className="!text-right">Econ</th>
          </tr>
        </thead>
        <tbody>
          {(innings.bowling || []).map((row) => {
            const player = findPlayer(row.player, match);
            const isCurrent = String(row.player?._id || row.player) === String(innings.bowler?._id || innings.bowler || "");
            return (
              <tr key={String(row.player?._id || row.player)}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar player={player} size="xs" />
                    <span className={cn("text-[13px] font-semibold", isCurrent ? "text-lime" : "text-white/85")}>{playerName(player)}</span>
                  </div>
                </td>
                <td className="!text-right font-mono text-white/65">{oversOf(row.balls)}</td>
                <td className="!text-right font-mono text-white/55">{row.maidens}</td>
                <td className="!text-right font-mono text-white/65">{row.runs}</td>
                <td className="!text-right font-mono font-bold text-lime">{row.wickets}</td>
                <td className="!text-right font-mono text-white/55">{row.balls ? ((row.runs / row.balls) * 6).toFixed(2) : "0.00"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FallOfWickets({ innings, match }) {
  if (!innings.fow?.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30">Fall of wickets</p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-white/55">
        {innings.fow.map((row) => (
          <span key={row.wicket}>
            <span className="font-mono font-semibold text-white/80">{row.runs}/{row.wicket}</span>{" "}
            <span className="text-white/40">({row.over} ov)</span>{" "}
            {playerName(findPlayer(row.player, match)) !== "—" ? playerName(findPlayer(row.player, match)) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Scorecard({ match }) {
  const innings = [...(match?.innings || [])].sort((a, b) => a.number - b.number);
  if (!innings.length) {
    return <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">The scorecard will appear once the match begins.</p>;
  }

  return (
    <div className="space-y-4">
      {innings.map((inningsRow) => {
        const team = typeof inningsRow.battingTeam === "object" ? inningsRow.battingTeam : match?.[String(inningsRow.battingTeam) === String(match?.teamA?._id) ? "teamA" : "teamB"];
        return (
          <div key={inningsRow.number} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime/10 text-xs font-bold text-lime">{inningsRow.number + 1}</span>
                <div>
                  <p className="text-sm font-bold text-white">{teamName(team)} <span className="font-normal text-white/35">innings</span></p>
                  <p className="text-[10px] text-white/35">{inningsRow.completed ? "completed" : "in progress"} · {inningsRow.overs} overs</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-bold text-lime">{inningsRow.runs}/{inningsRow.wickets}</p>
                <p className="text-[10px] text-white/35">RR {runRate(inningsRow.runs, inningsRow.balls)}</p>
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <BattingTable innings={inningsRow} match={match} />
              <BowlingTable innings={inningsRow} match={match} />
              <FallOfWickets innings={inningsRow} match={match} />
            </div>
          </div>
        );
      })}
      {match?.result?.text && (
        <div className="rounded-xl border border-lime/20 bg-lime/[0.06] px-4 py-3 text-sm font-semibold text-lime">
          {match.result.text}
          {match.playerOfMatch?.name && <span className="ml-2 text-[11px] font-normal text-white/45">Player of the match: {match.playerOfMatch.name}</span>}
        </div>
      )}
    </div>
  );
}
