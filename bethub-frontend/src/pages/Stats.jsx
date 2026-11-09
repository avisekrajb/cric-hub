import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Crown,
  Eye,
  Flame,
  LineChart as LineChartIcon,
  Medal,
  Percent,
  Shield,
  Swords,
  Target,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { PlayerAvatar, TeamLogo } from "../components/common/Avatars";
import { BarChart, HorizontalBars, LineChart } from "../components/StatsCharts";
import Tabs from "../components/common/Tabs";
import { EmptyState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useI18n } from "../contexts/LanguageContext";
import { cn, formatNumber, teamName, timeAgo } from "../lib/utils";

const mainTabKeys = [
  { key: "standings", labelKey: "stats.tabStandings" },
  { key: "batting", labelKey: "stats.tabBatting" },
  { key: "bowling", labelKey: "stats.tabBowling" },
  { key: "series", labelKey: "stats.tabSeries" },
  { key: "analytics", labelKey: "stats.tabAnalytics" },
];

const battingTypeKeys = [
  { key: "runs", labelKey: "stats.mostRuns" },
  { key: "sixes", labelKey: "stats.mostSixes" },
  { key: "fours", labelKey: "stats.mostFours" },
  { key: "strikeRate", labelKey: "stats.bestStrikeRate" },
];

const bowlingTypeKeys = [
  { key: "wickets", labelKey: "stats.mostWickets" },
  { key: "runs", labelKey: "stats.mostRuns" },
];

function FormPips({ form = [] }) {
  return (
    <span className="flex gap-1">
      {form.map((row, index) => (
        <span
          key={`${row}-${index}`}
          className={cn(
            "grid h-5 w-5 place-items-center rounded text-[9px] font-bold",
            row === "W" ? "bg-lime/15 text-lime" : row === "L" ? "bg-coral/15 text-coral" : "bg-white/[0.06] text-white/45"
          )}
        >
          {row}
        </span>
      ))}
    </span>
  );
}

export default function Stats() {
  const { t } = useI18n();
  const [tab, setTab] = useState("standings");
  const [series, setSeries] = useState("all");
  const [batType, setBatType] = useState("runs");
  const [bowlType, setBowlType] = useState("wickets");

  const mainTabs = mainTabKeys.map((item) => ({ key: item.key, label: t(item.labelKey) }));
  const battingTypes = battingTypeKeys.map((item) => ({ key: item.key, label: t(item.labelKey) }));
  const bowlingTypes = bowlingTypeKeys.map((item) => ({ key: item.key, label: t(item.labelKey) }));

  const { data: standings, loading: standingsLoading } = useFetch(
    `/api/stats/standings${series !== "all" ? `?series=${encodeURIComponent(series)}` : ""}`,
    { poll: 60000 }
  );
  const { data: leaderboard, loading: boardLoading } = useFetch(
    `/api/stats/leaderboard?limit=25&type=${tab === "bowling" ? bowlType : batType}`,
    { poll: 60000 }
  );
  const { data: seriesData } = useFetch("/api/stats/series", { poll: 90000 });
  const { data: analyticsData, loading: analyticsLoading } = useFetch("/api/stats/analytics", {
    enabled: tab === "analytics",
    poll: 60000,
  });

  const table = standings?.table || [];
  const players = leaderboard?.players || [];
  const seriesRows = seriesData?.series || [];
  const analytics = analyticsData?.analytics || analyticsData;

  const seriesOptions = useMemo(() => seriesRows.map((row) => row.name).filter(Boolean), [seriesRows]);

  const runChart = useMemo(
    () =>
      (analytics?.players?.topRuns || []).slice(0, 8).map((row) => ({
        label: row.player?.name || "Player",
        value: row.runs || 0,
      })),
    [analytics]
  );

  const timeline = analytics?.timeline || [];
  const teamRows = analytics?.teams || [];
  const records = analytics?.records || {};
  const totals = analytics?.totals || {};

  const recordCards = [
    { key: "highestTeamScore", label: "Highest team total", icon: Flame, accent: "text-lime" },
    { key: "lowestTeamScore", label: "Lowest team total", icon: Shield, accent: "text-sky" },
    { key: "highestIndividualScore", label: "Highest individual", icon: Crown, accent: "text-lime" },
    { key: "lowestIndividualScore", label: "Lowest individual", icon: Activity, accent: "text-white/60" },
    { key: "bestBowling", label: "Best bowling", icon: Target, accent: "text-coral" },
    { key: "mostSixesInnings", label: "Most sixes (innings)", icon: Flame, accent: "text-coral" },
    { key: "mostFoursInnings", label: "Most fours (innings)", icon: Medal, accent: "text-sky" },
  ];

  return (
    <div className="container-x py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2"><BarChart3 size={13} /> {t("stats.desk")}</p>
          <h1 className="mt-1 font-display text-3xl font-700 tracking-tight text-white sm:text-4xl">{t("stats.title")}</h1>
          <p className="mt-1 text-sm text-white/45">{t("stats.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="chip"><Activity size={11} className="text-mint" /> {t("stats.realtime")}</span>
          <span className="chip"><Trophy size={11} className="text-lime" /> {t("stats.seriesCount", { count: seriesRows.length })}</span>
        </div>
      </div>

      <Tabs tabs={mainTabs} value={tab} onChange={setTab} className="mb-4" />

      {tab === "standings" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-white/40">{series === "all" ? t("stats.allCompetitions") : series} · {t("stats.pointsTable")}</p>
            <select value={series} onChange={(event) => setSeries(event.target.value)} className="input !w-auto !py-1.5 text-[11px]">
              <option value="all" className="bg-ink-900">{t("common.allSeries")}</option>
              {seriesOptions.map((name) => <option key={name} value={name} className="bg-ink-900">{name}</option>)}
            </select>
          </div>

          {standingsLoading && !standings ? (
            <PageLoader label={t("stats.loadingTable")} />
          ) : table.length ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-base min-w-[720px]">
                  <thead>
                    <tr>
                      <th className="w-10">#</th>
                      <th>Team</th>
                      <th className="!text-right">P</th>
                      <th className="!text-right">W</th>
                      <th className="!text-right">L</th>
                      <th className="!text-right">T/NR</th>
                      <th className="!text-right">Pts</th>
                      <th className="!text-right">NRR</th>
                      <th>Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.map((row, index) => (
                      <tr key={row.team?._id || index}>
                        <td className="font-mono text-[11px] text-white/30">{index + 1}</td>
                        <td>
                          <Link to={`/teams/${row.team?._id}`} className="flex items-center gap-2.5 hover:text-lime">
                            <TeamLogo team={row.team} size="xs" />
                            <span className="text-[12px] font-semibold text-white/85">{teamName(row.team)}</span>
                            <span className="hidden text-[10px] text-white/30 sm:inline">{row.team?.name}</span>
                          </Link>
                        </td>
                        <td className="!text-right font-mono text-white/60">{row.played}</td>
                        <td className="!text-right font-mono text-lime">{row.won}</td>
                        <td className="!text-right font-mono text-white/60">{row.lost}</td>
                        <td className="!text-right font-mono text-white/40">{row.tied + row.noResult}</td>
                        <td className="!text-right font-mono font-bold text-white">{row.points}</td>
                        <td className={cn("!text-right font-mono", row.nrr > 0 ? "text-mint" : row.nrr < 0 ? "text-coral" : "text-white/50")}>{row.nrr > 0 ? "+" : ""}{row.nrr}</td>
                        <td><FormPips form={row.form} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon={<Trophy size={20} />} title={t("stats.noCompleted")} text={t("stats.noCompletedText")} />
          )}
        </div>
      )}

      {(tab === "batting" || tab === "bowling") && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              {(tab === "batting" ? battingTypes : bowlingTypes).map((option) => (
                <button
                  key={option.key}
                  onClick={() => (tab === "batting" ? setBatType(option.key) : setBowlType(option.key))}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition",
                    (tab === "batting" ? batType : bowlType) === option.key
                      ? "bg-lime text-ink-950"
                      : "border border-white/[0.07] bg-white/[0.02] text-white/50 hover:text-white"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-white/30">{t("stats.liveAndFinished")}</span>
          </div>

          {boardLoading && !leaderboard ? (
            <PageLoader label={t("stats.loadingRuns")} />
          ) : players.length ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-base min-w-[760px]">
                  <thead>
                    <tr>
                      <th className="w-10">#</th>
                      <th>Player</th>
                      <th className="!text-right">M</th>
                      {tab === "batting" ? (
                        <>
                          <th className="!text-right">Inns</th>
                          <th className="!text-right">Runs</th>
                          <th className="!text-right">HS</th>
                          <th className="!text-right">Avg</th>
                          <th className="!text-right">SR</th>
                          <th className="!text-right">4s</th>
                          <th className="!text-right">6s</th>
                        </>
                      ) : (
                        <>
                          <th className="!text-right">Overs</th>
                          <th className="!text-right">Wkts</th>
                          <th className="!text-right">Best</th>
                          <th className="!text-right">Econ</th>
                          <th className="!text-right">Avg</th>
                          <th className="!text-right">Maidens</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((row, index) => (
                      <tr key={row.playerId || row.player?._id || index}>
                        <td className="font-mono text-[11px] text-white/30">{index + 1}</td>
                        <td>
                          <Link to={`/players/${row.player?._id}`} className="flex items-center gap-2.5 hover:text-lime">
                            <PlayerAvatar player={row.player} size="xs" />
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-semibold text-white/85">{row.player?.name}</span>
                              <span className="block text-[9px] text-white/30">{row.player?.role}{row.player?.country?.code ? ` · ${row.player.country.code}` : ""}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="!text-right font-mono text-white/50">{row.matches || 0}</td>
                        {tab === "batting" ? (
                          <>
                            <td className="!text-right font-mono text-white/50">{row.innings || 0}</td>
                            <td className="!text-right font-mono font-bold text-lime">{row.runs || 0}</td>
                            <td className="!text-right font-mono text-white/60">{row.highScore || 0}</td>
                            <td className="!text-right font-mono text-white/60">{row.average ?? 0}</td>
                            <td className="!text-right font-mono text-white/60">{row.strikeRate ?? 0}</td>
                            <td className="!text-right font-mono text-white/60">{row.fours || 0}</td>
                            <td className="!text-right font-mono text-white/60">{row.sixes || 0}</td>
                          </>
                        ) : (
                          <>
                            <td className="!text-right font-mono text-white/50">{((row.bowlingBalls || 0) / 6).toFixed(1)}</td>
                            <td className="!text-right font-mono font-bold text-lime">{row.wickets || 0}</td>
                            <td className="!text-right font-mono text-white/60">{row.bestWickets || 0}W</td>
                            <td className="!text-right font-mono text-white/60">{row.economy ?? 0}</td>
                            <td className="!text-right font-mono text-white/60">{row.bowlingStrikeRate ?? 0}</td>
                            <td className="!text-right font-mono text-white/60">{row.maidens || 0}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState icon={<Target size={20} />} title={t("stats.noPlayerNumbers")} text={t("stats.noPlayerNumbersText")} />
          )}
        </div>
      )}

      {tab === "series" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {seriesRows.length ? seriesRows.map((row) => (
            <Link key={row.name} to={`/live?series=${encodeURIComponent(row.name)}`} className="card card-hover group p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime/10 text-lime"><Crown size={18} /></span>
                {row.live > 0 ? <span className="chip-live">{row.live} {t("live.live")}</span> : <span className="chip">{t("home.matchCount", { count: row.matches })}</span>}
              </div>
              <p className="mt-3 font-display text-base font-700 text-white group-hover:text-lime">{row.name}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-white/35"><CalendarDays size={11} /> {t("home.latest")} {timeAgo(row.latest)}</p>
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[10px] text-white/35">
                <span><b className="text-white/70">{row.matches}</b> {t("stats.fixtures")}</span>
                <span className="inline-flex items-center gap-1 text-lime">{t("stats.open")} <Flame size={11} /></span>
              </div>
            </Link>
          )) : <div className="sm:col-span-2 xl:col-span-3"><EmptyState icon={<Medal size={20} />} title={t("stats.noSeries")} text={t("stats.noSeriesText")} /></div>}
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-3">
          {analyticsLoading && !analytics ? (
            <PageLoader label={t("stats.loadingAnalytics")} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-6">
                {[
                  { label: "Matches", value: totals.matches || 0, icon: Trophy, accent: "text-lime" },
                  { label: "Runs", value: totals.runs || 0, icon: TrendingUp, accent: "text-lime" },
                  { label: "Wickets", value: totals.wickets || 0, icon: Target, accent: "text-coral" },
                  { label: "Fours", value: totals.fours || 0, icon: Medal, accent: "text-sky" },
                  { label: "Sixes", value: totals.sixes || 0, icon: Flame, accent: "text-coral" },
                  { label: "Views", value: Math.max(totals.views || 0, totals.streamViews || 0), icon: Eye, accent: "text-mint" },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="card flex items-center gap-2.5 p-3">
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04]", card.accent)}>
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">{card.label}</p>
                        <p className="font-display text-lg font-700 leading-tight text-white">{formatNumber(card.value)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-white"><BarChart3 size={14} className="text-lime" /> Most runs</p>
                      <p className="text-[10px] text-white/35">Top 8 run-scorers across live and finished matches</p>
                    </div>
                    <span className="chip">bar</span>
                  </div>
                  <BarChart data={runChart} color="#c8ff3d" formatValue={(value) => formatNumber(value)} emptyLabel="No runs recorded yet" />
                </div>

                <div className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-white"><LineChartIcon size={14} className="text-sky" /> Match timeline</p>
                      <p className="text-[10px] text-white/35">Runs and wickets per month</p>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-semibold">
                      <span className="inline-flex items-center gap-1 text-lime"><span className="h-1.5 w-1.5 rounded-full bg-lime" /> runs</span>
                      <span className="inline-flex items-center gap-1 text-coral"><span className="h-1.5 w-1.5 rounded-full bg-coral" /> wickets</span>
                    </div>
                  </div>
                  <LineChart
                    data={timeline}
                    xKey="label"
                    series={[
                      { key: "runs", label: "Runs", color: "#c8ff3d" },
                      { key: "wickets", label: "Wickets", color: "#ff6b6b" },
                    ]}
                    formatValue={(value) => formatNumber(value)}
                    emptyLabel="Finish a match to start the timeline"
                  />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
                <div className="card p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-bold text-white"><Percent size={14} className="text-mint" /> Winning percentage</p>
                      <p className="text-[10px] text-white/35">Teams compared by win rate, then matches played</p>
                    </div>
                    <span className="chip"><Swords size={10} /> {teamRows.length} teams</span>
                  </div>
                  <HorizontalBars
                    rows={teamRows.slice(0, 10).map((row) => ({
                      label: teamName(row.team),
                      value: row.winPct || 0,
                      decimals: 1,
                      color: row.team?.color || "#c8ff3d",
                      logo: <TeamLogo team={row.team} size="xs" />,
                    }))}
                    max={100}
                    color="#37e6a0"
                  />
                  <div className="mt-3 overflow-x-auto">
                    <table className="table-base min-w-[520px]">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th className="!text-right">P</th>
                          <th className="!text-right">W</th>
                          <th className="!text-right">L</th>
                          <th className="!text-right">Win %</th>
                          <th className="!text-right">HS</th>
                          <th className="!text-right">NRR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamRows.slice(0, 10).map((row) => (
                          <tr key={row.team?._id}>
                            <td>
                              <Link to={`/teams/${row.team?._id}`} className="flex items-center gap-2 hover:text-lime">
                                <TeamLogo team={row.team} size="xs" />
                                <span className="text-[11px] font-semibold text-white/80">{teamName(row.team)}</span>
                              </Link>
                            </td>
                            <td className="!text-right font-mono text-white/50">{row.played || 0}</td>
                            <td className="!text-right font-mono text-lime">{row.won || 0}</td>
                            <td className="!text-right font-mono text-white/50">{row.lost || 0}</td>
                            <td className="!text-right font-mono font-bold text-white">{row.winPct ?? 0}%</td>
                            <td className="!text-right font-mono text-white/55">{row.highScore || 0}</td>
                            <td className={cn("!text-right font-mono", row.nrr > 0 ? "text-mint" : row.nrr < 0 ? "text-coral" : "text-white/40")}>{row.nrr > 0 ? "+" : ""}{row.nrr ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card p-4">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-white"><Trophy size={14} className="text-lime" /> Leaders</p>
                  <p className="text-[10px] text-white/35">Auto-computed awards and impact numbers</p>
                  <div className="mt-3 space-y-2">
                    {(analytics?.players?.topPom || []).slice(0, 4).map((row, index) => (
                      <Link key={row.player?._id || index} to={`/players/${row.player?._id}`} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 transition hover:border-lime/30">
                        <PlayerAvatar player={row.player} size="xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-white/80">{row.player?.name}</span>
                          <span className="block text-[9px] text-white/35">{row.pom} player-of-match · {row.matches} matches</span>
                        </span>
                        <Medal size={13} className="shrink-0 text-lime" />
                      </Link>
                    ))}
                    {(analytics?.players?.topWickets || []).slice(0, 4).map((row, index) => (
                      <Link key={`w-${row.player?._id || index}`} to={`/players/${row.player?._id}`} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 transition hover:border-coral/30">
                        <PlayerAvatar player={row.player} size="xs" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-white/80">{row.player?.name}</span>
                          <span className="block text-[9px] text-white/35">{row.wickets} wickets · econ {row.economy}</span>
                        </span>
                        <Target size={13} className="shrink-0 text-coral" />
                      </Link>
                    ))}
                    {!(analytics?.players?.topPom || []).length && !(analytics?.players?.topWickets || []).length && (
                      <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-white/30">Leaders appear after the first completed match.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-bold text-white"><Crown size={14} className="text-lime" /> Auto-computed records</p>
                    <p className="text-[10px] text-white/35">Recalculated from every scorecard — no manual entry</p>
                  </div>
                  {analytics?.generatedAt && <span className="hidden text-[9px] text-white/25 sm:block">updated {timeAgo(analytics.generatedAt)}</span>}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {recordCards.map((card) => {
                    const Icon = card.icon;
                    const record = records[card.key];
                    return (
                      <div key={card.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">
                          <Icon size={11} className={card.accent} /> {card.label}
                        </p>
                        {record ? (
                          <>
                            <p className="mt-1.5 truncate text-sm font-bold text-white">{record.label || "—"}</p>
                            <p className="truncate text-[10px] text-white/35">{record.detail || record.series || ""}</p>
                          </>
                        ) : (
                          <p className="mt-1.5 text-[11px] text-white/25">Not recorded yet</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime/10 text-lime"><TrendingUp size={16} /></span>
          <div><p className="text-[10px] uppercase tracking-wider text-white/30">{t("stats.teamsRanked")}</p><p className="font-display text-lg font-700 text-white">{formatNumber(table.length)}</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint/10 text-mint"><Target size={16} /></span>
          <div><p className="text-[10px] uppercase tracking-wider text-white/30">{t("stats.playersTracked")}</p><p className="font-display text-lg font-700 text-white">{formatNumber(players.length)}</p></div>
        </div>
        <div className="card flex items-center gap-3 p-3.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky/10 text-sky"><Trophy size={16} /></span>
          <div><p className="text-[10px] uppercase tracking-wider text-white/30">{t("stats.competitions")}</p><p className="font-display text-lg font-700 text-white">{formatNumber(seriesRows.length)}</p></div>
        </div>
      </div>
    </div>
  );
}
