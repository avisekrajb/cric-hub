import { Activity, ArrowUpRight, Gauge, Target, Zap } from "lucide-react";
import { useI18n } from "../contexts/LanguageContext";
import { cn, formatNumber, runRate, teamName } from "../lib/utils";

export function WinProbability({ match, insights }) {
  const { t } = useI18n();
  if (!insights) return null;
  const current = match?.innings?.[match.currentInnings];
  const probability = Math.round(insights.winProbability ?? 50);
  const batting = current?.battingTeam;
  const bowling = current?.bowlingTeam;
  const battingPct = probability;
  const bowlingPct = 100 - probability;

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
          <Gauge size={13} className="text-lime" /> {t("insights.winPredictor")}
        </p>
        <span className="chip !px-2 !py-0.5 !text-[9px]">{t("insights.liveModel")}</span>
      </div>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <p className="text-2xl font-extrabold tabular-nums text-lime">{battingPct}%</p>
          <p className="text-[11px] font-semibold text-white/55">{teamName(batting)}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold tabular-nums text-white/70">{bowlingPct}%</p>
          <p className="text-[11px] font-semibold text-white/45">{teamName(bowling)}</p>
        </div>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
        <span className="h-full rounded-full bg-gradient-to-r from-lime-deep to-lime transition-all duration-700" style={{ width: `${battingPct}%` }} />
        <span className="h-full flex-1 bg-gradient-to-r from-white/20 to-white/10 transition-all duration-700" />
      </div>
      <p className="mt-2 text-[10px] text-white/30">{t("insights.disclaimer")}</p>
    </div>
  );
}

export function WormChart({ match, insights }) {
  const { t } = useI18n();
  if (!insights?.worm?.length) return null;
  const maxOver = Math.max(1, match?.overs || 20, ...insights.worm.map((row) => row.points?.at(-1)?.over || 0));
  const maxRuns = Math.max(30, ...insights.worm.map((row) => row.runs || 0), ...insights.worm.flatMap((row) => (row.points || []).map((p) => p.runs)));
  const width = 680;
  const height = 230;
  const pad = { left: 38, right: 16, top: 14, bottom: 26 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (over) => pad.left + (Math.min(over, maxOver) / maxOver) * plotW;
  const y = (runs) => pad.top + plotH - (runs / maxRuns) * plotH;
  const colors = ["#c8ff3d", "#5cc8ff"];

  return (
    <div className="card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
          <Activity size={13} className="text-lime" /> {t("insights.runWorm")}
        </p>
        <div className="flex flex-wrap gap-2">
          {insights.worm.map((row, index) => (
            <span key={index} className="inline-flex items-center gap-1.5 text-[10px] text-white/50">
              <span className="h-1.5 w-3 rounded-full" style={{ background: colors[index % colors.length] }} />
              {teamName(row.team)} {row.runs}/{row.wickets}
            </span>
          ))}
        </div>
      </div>
      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={t("insights.runsPerOver")}>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <g key={ratio}>
              <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH * ratio} y2={pad.top + plotH * ratio} stroke="rgba(255,255,255,.06)" strokeDasharray="3 5" />
              <text x={pad.left - 8} y={pad.top + plotH * ratio + 3} textAnchor="end" fill="rgba(255,255,255,.28)" fontSize="9">
                {Math.round(maxRuns * (1 - ratio))}
              </text>
            </g>
          ))}
          {Array.from({ length: 5 }, (_, i) => Math.round((maxOver / 4) * i)).map((over) => (
            <text key={over} x={x(over)} y={height - 8} textAnchor="middle" fill="rgba(255,255,255,.28)" fontSize="9">
              {over}
            </text>
          ))}
          {insights.worm.map((row, index) => {
            const points = (row.points || []).map((point) => `${x(point.over)},${y(point.runs)}`).join(" ");
            const last = row.points?.at(-1);
            return (
              <g key={index}>
                <polyline points={points} fill="none" stroke={colors[index % colors.length]} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                {last && <circle cx={x(last.over)} cy={y(last.runs)} r="3.5" fill={colors[index % colors.length]} />}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function InsightTiles({ match, insights }) {
  const { t } = useI18n();
  if (!insights) return null;
  const current = match?.innings?.[match.currentInnings];
  const tiles = [
    { label: t("insights.crr"), value: insights.currentRunRate?.toFixed(2) ?? runRate(current?.runs, current?.balls), icon: Zap, tone: "text-lime" },
    { label: t("insights.required"), value: insights.requiredRunRate != null ? insights.requiredRunRate.toFixed(2) : "—", icon: Target, tone: "text-sky" },
    { label: t("insights.need"), value: insights.required != null ? `${insights.required} off ${insights.ballsLeft}` : "—", icon: ArrowUpRight, tone: "text-white" },
    { label: t("insights.projected"), value: insights.projected ? formatNumber(insights.projected) : "—", icon: Activity, tone: "text-white/70" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-white/[0.07] bg-ink-900/60 p-3">
          <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">
            <tile.icon size={10} /> {tile.label}
          </p>
          <p className={cn("mt-1 font-mono text-lg font-bold tabular-nums", tile.tone)}>{tile.value}</p>
        </div>
      ))}
    </div>
  );
}

export function PartnershipCard({ insights }) {
  const { t } = useI18n();
  if (!insights) return null;
  const partnership = insights.partnership;
  const last5 = insights.last5Overs || [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{t("insights.partnership")}</p>
        {partnership ? (
          <>
            <p className="mt-1 text-xl font-extrabold text-white">{partnership.runs} <span className="text-sm font-medium text-white/40">{t("insights.runs")}</span></p>
            <p className="mt-0.5 text-[11px] text-white/45">{t("insights.partnershipLine", { balls: partnership.balls, a: partnership.playerA?.name || "—", b: partnership.playerB?.name || "—" })}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-white/40">{t("insights.noPartnership")}</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <span className="rounded-lg bg-white/[0.03] p-2"><span className="block text-white/35">{t("insights.wicketsLeft")}</span><span className="font-bold text-white/80">{insights.wicketsLeft}</span></span>
          <span className="rounded-lg bg-white/[0.03] p-2"><span className="block text-white/35">{t("insights.oversLeft")}</span><span className="font-bold text-white/80">{insights.oversLeft?.toFixed(1)}</span></span>
        </div>
      </div>
      <div className="card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{t("insights.last5")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {last5.length ? (
            last5.map((over) => (
              <div key={over.over} className="min-w-[52px] rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-center">
                <p className="text-[9px] text-white/35">{t("detail.overShort", { n: over.over })}</p>
                <p className="font-mono text-sm font-bold text-white/85">{over.runs}</p>
                <p className="text-[9px] text-white/30">{t("insights.wkt", { n: over.wickets })}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-white/35">{t("insights.noOvers")}</p>
          )}
        </div>
        {last5.length > 0 && (
          <p className="mt-3 text-[10px] text-white/35">{t("insights.last5Summary", { runs: insights.last5Runs, tone: insights.last5Runs / Math.min(5, last5.length || 1) > 9 ? t("insights.scoringFreely") : t("insights.bowlersOnTop") })}</p>
        )}
      </div>
    </div>
  );
}
