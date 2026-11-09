import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  CircleDot,
  Flag,
  Info,
  Loader2,
  MessageSquare,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Target,
  Tv,
  Undo2,
  UserRound,
  Zap,
} from "lucide-react";
import { AdminPage, Field, Panel, StatCard } from "./components/AdminUI";
import Modal from "../components/common/Modal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import { PlayerAvatar, TeamLogo } from "../components/common/Avatars";
import { LiveBadge, StatusPill } from "../components/common/Badges";
import { ErrorState, PageLoader } from "../components/common/States";
import { useFetch } from "../hooks/useFetch";
import { useSocket, useSocketEvent } from "../contexts/SocketContext";
import { useToast } from "../contexts/ToastContext";
import { api } from "../lib/api";
import { cn, formatNumber, resultText, runRate, teamName } from "../lib/utils";

const WICKET_TYPES = [
  { value: "bowled", label: "Bowled" },
  { value: "caught", label: "Caught" },
  { value: "lbw", label: "LBW" },
  { value: "runOut", label: "Run out" },
  { value: "stumped", label: "Stumped" },
  { value: "hitWicket", label: "Hit wicket" },
  { value: "retired", label: "Retired" },
  { value: "obstructing", label: "Obstructing the field" },
  { value: "timedOut", label: "Timed out" },
  { value: "handledBall", label: "Handled the ball" },
  { value: "hitTheBallTwice", label: "Hit the ball twice" },
];

const EXTRAS = [
  { value: "wide", label: "Wide", short: "Wd" },
  { value: "noBall", label: "No ball", short: "Nb" },
  { value: "bye", label: "Bye", short: "B" },
  { value: "legBye", label: "Leg bye", short: "Lb" },
  { value: "penalty", label: "Penalty", short: "P" },
];

const idOf = (ref) => String(ref?._id || ref || "");

const ballLabel = (ball) => {
  if (ball.wicket?.isWicket) return "W";
  if (ball.extraType === "wide") return "Wd";
  if (ball.extraType === "noBall") return "Nb";
  if (ball.extraType === "bye") return "B";
  if (ball.extraType === "legBye") return "Lb";
  if (ball.extraType === "penalty") return "P";
  return String(ball.batRuns ?? 0);
};

function BatterRow({ entry, active, onStrike }) {
  if (!entry) return null;
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl px-2.5 py-2", active ? "bg-lime/[0.06]" : "bg-white/[0.02]")}>
      <PlayerAvatar player={entry.player} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-white/85">
          {entry.player?.name || "Batter"}
          {entry.out && <span className="rounded bg-coral/15 px-1 text-[8px] font-bold text-coral">OUT</span>}
        </p>
        <p className="truncate text-[9px] text-white/30">
          {entry.out ? entry.dismissal?.text || "Out" : active ? "On strike" : "At the crease"}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm font-bold text-white">{entry.runs}</p>
        <p className="font-mono text-[9px] text-white/30">{entry.balls}b · {entry.fours}×4 {entry.sixes}×6</p>
      </div>
      {active && !entry.out && (
        <button
          onClick={onStrike}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] font-semibold text-white/45 transition hover:border-lime/30 hover:text-lime"
          title="Swap strike manually"
        >
          swap
        </button>
      )}
    </div>
  );
}

export default function AdminScoreConsole() {
  const { id } = useParams();
  const { success, error: toastError } = useToast();
  const { joinMatch, leaveMatch } = useSocket();
  const { data, loading, error, refetch, setData } = useFetch(`/api/matches/${id}`, { deps: [id], poll: 60000 });
  const { data: ballsData, refetch: refetchBalls } = useFetch(`/api/matches/${id}/balls?limit=40`, { deps: [id] });
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [commentary, setCommentary] = useState("");
  const [nextBowler, setNextBowler] = useState("");
  const [wicket, setWicket] = useState({ type: "bowled", outBatsman: "striker", fielder: "", newBatsman: "", batRuns: 0 });
  const [extra, setExtra] = useState({ type: "wide", runs: 1, batRuns: 0 });
  const refreshTimer = useRef(null);

  const match = data?.match;
  const balls = ballsData?.balls || [];
  const innings = match?.innings?.[match.currentInnings];
  const battingSlot = useMemo(() => {
    if (!match || !innings) return "";
    return idOf(innings.battingTeam) === idOf(match.teamA) ? "A" : "B";
  }, [match, innings]);
  const bowlingSlot = battingSlot === "A" ? "B" : "A";
  const bowlingLineup = match?.lineups?.[bowlingSlot] || [];
  const battingTeam = match?.[`team${battingSlot || "A"}`];
  const bowlingTeam = match?.[`team${bowlingSlot}`];
  const striker = innings?.batting?.find((row) => idOf(row.player) === idOf(innings?.striker));
  const nonStriker = innings?.batting?.find((row) => idOf(row.player) === idOf(innings?.nonStriker));
  const bowlerEntry = innings?.bowling?.find((row) => idOf(row.player) === idOf(innings?.bowler));
  const strikerPlayer = striker?.player;
  const nonStrikerPlayer = nonStriker?.player;
  const bowlerPlayer = bowlerEntry?.player;
  const availableBatsmen = useMemo(
    () =>
      (innings?.batting || []).filter(
        (row) =>
          !row.out &&
          row.balls === 0 &&
          idOf(row.player) !== idOf(innings?.striker) &&
          idOf(row.player) !== idOf(innings?.nonStriker)
      ),
    [innings]
  );

  useEffect(() => {
    if (!match?._id) return undefined;
    joinMatch(match._id);
    return () => leaveMatch(match._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?._id]);

  useSocketEvent("match:update", (payload) => {
    if (!payload?.match || String(payload.match._id) !== String(id)) return;
    setData({ match: payload.match });
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      refetchBalls(true);
    }, 500);
  });

  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  useEffect(() => {
    if (innings?.bowler) setNextBowler(idOf(innings.bowler));
  }, [innings?.bowler]);

  const refresh = async () => {
    await Promise.all([refetch(true), refetchBalls(true)]);
  };

  const post = async (path, body, message) => {
    setBusy(path);
    setActionError("");
    try {
      const result = await api(`/api/matches/${id}${path}`, { method: "POST", body });
      if (result?.match) setData({ match: result.match });
      if (message) success(message);
      await refresh();
      return result;
    } catch (err) {
      setActionError(err.message || "That action failed");
      toastError(err.message || "That action failed");
      return null;
    } finally {
      setBusy("");
    }
  };

  const addBall = (payload, message) => post("/ball", payload, message);
  const addRuns = (runs) => addBall({ batRuns: runs });

  const submitExtra = async () => {
    const payload = {
      batRuns: extra.type === "noBall" ? Number(extra.batRuns) || 0 : 0,
      extra: { type: extra.type, runs: Number(extra.runs) || 1 },
    };
    const result = await addBall(payload, "Extra recorded");
    if (result) setExtraOpen(false);
  };

  const submitWicket = async () => {
    const payload = {
      batRuns: Number(wicket.batRuns) || 0,
      wicket: {
        type: wicket.type,
        outBatsman: wicket.outBatsman,
        fielder: wicket.fielder || undefined,
        newBatsman: wicket.newBatsman || undefined,
      },
    };
    const result = await addBall(payload, "Wicket recorded");
    if (result) {
      setWicketOpen(false);
      setWicket({ type: "bowled", outBatsman: "striker", fielder: "", newBatsman: "", batRuns: 0 });
    }
  };

  const applyBowler = async () => {
    if (!nextBowler) return;
    await post("/bowler", { playerId: nextBowler }, "Bowler changed");
  };

  const submitCommentary = async () => {
    const text = commentary.trim();
    if (!text) return;
    const result = await post("/commentary", { text }, "Commentary posted");
    if (result) setCommentary("");
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(confirm.action);
    setActionError("");
    try {
      if (confirm.action === "start") {
        await api(`/api/matches/${id}/start`, { method: "POST" });
        success("Match started — first ball is ready");
      } else if (confirm.action === "finish") {
        await api(`/api/matches/${id}/finish`, { method: "POST", body: {} });
        success("Match finished. Result and player of the match are published.");
      } else if (confirm.action === "reset") {
        await api(`/api/matches/${id}/reset`, { method: "POST", body: { confirm: true } });
        success("Scorecard reset");
      } else if (confirm.action === "innings") {
        await api(`/api/matches/${id}/end-innings`, { method: "POST", body: {} });
        success("Innings closed");
      }
      setConfirm(null);
      await refresh();
    } catch (err) {
      setActionError(err.message || "That action failed");
      toastError(err.message || "That action failed");
    } finally {
      setBusy("");
    }
  };

  if (loading && !match) return <PageLoader label="Opening the scorer's console…" />;
  if (error && !match) return <div className="p-4"><ErrorState message={error} onRetry={() => refetch()} /></div>;
  if (!match) return null;

  const live = match.status === "live";
  const finished = match.status === "finished";
  const target = innings?.target;
  const ballsLeft = Math.max(0, (Number(match.overs) || 0) * 6 - (innings?.balls || 0));
  const currentOver = innings?.oversDetail?.[innings.oversDetail.length - 1];
  const overBalls = currentOver?.balls || [];
  const fielders = bowlingLineup.map((row) => row.player).filter(Boolean);
  const runDisabled = Boolean(busy) || !live || !innings || innings.completed;

  const confirmCopy = {
    start: {
      title: "Start the match?",
      text: "First innings opens with the toss winner's chosen decision. Line-ups lock and the public scoreboard goes live.",
      label: "Start match",
      danger: false,
    },
    finish: {
      title: "Finish the match?",
      text: "This ends the innings, calculates the result, chooses a player of the match and closes the live stream.",
      label: "Finish match",
      danger: true,
    },
    reset: {
      title: "Reset the whole scorecard?",
      text: "Every ball and innings is deleted and the fixture returns to upcoming. This cannot be undone.",
      label: "Reset match",
      danger: true,
    },
    innings: {
      title: "Close this innings?",
      text: "The current innings will be completed and the chase will begin immediately.",
      label: "End innings",
      danger: false,
    },
  }[confirm?.action] || {};

  return (
    <AdminPage
      eyebrow="Ball-by-ball"
      title="Scoring console"
      subtitle={`${teamName(match.teamA)} vs ${teamName(match.teamB)} · ${match.series}`}
      actions={
        <>
          <Link to="/admin/matches" className="btn-ghost btn-xs"><ArrowLeft size={13} /> Matches</Link>
          <Link to={`/admin/streams?match=${match._id}`} className="btn-ghost btn-xs"><Tv size={13} /> Broadcast</Link>
          <Link to={`/match/${match._id}`} className="btn-ghost btn-xs"><Sparkles size={13} /> Public view</Link>
        </>
      }
    >
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CircleDot} label="Score" value={innings ? `${innings.runs}/${innings.wickets}` : "—"} hint={innings ? `${innings.overs} overs` : "not started"} accent="text-lime" />
        <StatCard icon={Target} label="Run rate" value={innings ? runRate(innings.runs, innings.balls) : "0.00"} hint={target ? `${Math.max(0, target - innings.runs)} needed` : `${ballsLeft} balls left`} accent="text-sky" />
        <StatCard icon={Zap} label="This over" value={overBalls.length ? overBalls.length : 0} hint={`${formatNumber(currentOver?.runs || 0)} runs`} accent="text-mint" />
        <StatCard icon={Shield} label="Status" value={live ? "LIVE" : match.status.toUpperCase()} hint={finished ? resultText(match) : `${match.format} · ${match.overs} ov`} accent={live ? "text-coral" : "text-white/70"} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <section className="card overflow-hidden">
            <div className="relative border-b border-white/[0.06] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={match.status} />
                  {match.stream?.isLive && <LiveBadge label="VIDEO LIVE" />}
                  <span className="text-[10px] text-white/35">{match.format} · Match {match.matchNumber}</span>
                </div>
                {live && innings && (
                  <span className="text-[10px] font-semibold text-white/40">
                    {teamName(innings.battingTeam)} batting · {innings.overs} ov
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                    {innings ? `${teamName(battingTeam)} first innings` : "Waiting for the toss"}
                  </p>
                  <p className="mt-0.5 flex items-end gap-2 font-display text-5xl font-700 leading-none tabular-nums text-white">
                    {innings ? `${innings.runs}/${innings.wickets}` : "—"}
                    <span className="pb-1 font-mono text-sm font-medium text-white/35">{innings ? `${innings.overs} ov` : ""}</span>
                  </p>
                  {innings && (
                    <p className="mt-1 text-[11px] text-white/40">
                      CRR {runRate(innings.runs, innings.balls)}
                      {target ? ` · need ${Math.max(0, target - innings.runs)} from ${ballsLeft} balls · RRR ${runRate(Math.max(0, target - innings.runs), ballsLeft)}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {overBalls.length ? (
                    overBalls.map((ball, index) => (
                      <span
                        key={`${ball.at}-${index}`}
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold",
                          ball.isWicket
                            ? "bg-coral/20 text-coral"
                            : ball.label === "4" || ball.label === "6"
                              ? "bg-lime/20 text-lime"
                              : ball.extraType
                                ? "bg-amber-400/15 text-amber-200"
                                : "bg-white/[0.06] text-white/55"
                        )}
                      >
                        {ball.label}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-white/25">No balls in this over yet</span>
                  )}
                </div>
              </div>
            </div>

            {live && innings ? (
              <div className="space-y-2 p-4 sm:p-5">
                {battingTeam && bowlingTeam && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <TeamLogo team={battingTeam} size="sm" />
                    <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white/70">
                      {teamName(battingTeam)} <span className="font-normal text-white/30">vs</span> {teamName(bowlingTeam)}
                    </p>
                    {innings.freeHit && <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-lime">FREE HIT</span>}
                    {innings.needsBowler && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">NEW BOWLER</span>}
                  </div>
                )}
                <BatterRow entry={striker} active onStrike={() => post("/swap-strike", {}, "Strike swapped")} />
                <BatterRow entry={nonStriker} onStrike={() => post("/swap-strike", {}, "Strike swapped")} />
                {bowlerEntry && (
                  <div className="flex items-center gap-2.5 rounded-xl bg-sky/[0.04] px-2.5 py-2">
                    <PlayerAvatar player={bowlerPlayer} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white/80">{bowlerPlayer?.name || "Bowler"}</p>
                      <p className="text-[9px] text-white/30">Bowling · {Math.floor((bowlerEntry.balls || 0) / 6)}.{(bowlerEntry.balls || 0) % 6} ov</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-white">{bowlerEntry.wickets}</p>
                      <p className="font-mono text-[9px] text-white/30">{bowlerEntry.runs} runs · {bowlerEntry.maidens} maidens</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center">
                  <Play size={22} className="text-white/20" />
                  <p className="text-sm font-semibold text-white/70">
                    {finished ? "Match finished" : match.status === "innings-break" ? "Innings break" : "Ready when you are"}
                  </p>
                  <p className="max-w-sm text-[11px] leading-relaxed text-white/35">
                    {finished
                      ? resultText(match) || "The scorecard is complete. Reset it to start again."
                      : "Start the match to open the first innings and unlock the scoring controls."}
                  </p>
                  {match.status === "upcoming" && (
                    <button onClick={() => setConfirm({ action: "start" })} className="btn-primary btn-xs mt-1" disabled={Boolean(busy)}>
                      <Play size={12} /> Start match
                    </button>
                  )}
                  {match.status === "innings-break" && (
                    <p className="text-[10px] text-amber-200/70">The chase opens on the next delivery. Add a ball to continue.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          <Panel title="Scoring controls" subtitle="Tap a run value — strike and over changes are automatic">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {[0, 1, 2, 3, 4, 5, 6].map((run) => (
                <button
                  key={run}
                  type="button"
                  onClick={() => addRuns(run)}
                  disabled={runDisabled}
                  className={cn(
                    "grid h-16 place-items-center rounded-xl border text-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-30",
                    run === 4 || run === 6
                      ? "border-lime/30 bg-lime/10 text-lime hover:bg-lime/20"
                      : "border-white/10 bg-white/[0.03] text-white hover:border-white/20 hover:bg-white/[0.07]"
                  )}
                >
                  {busy === "/ball" ? <Loader2 size={16} className="animate-spin" /> : run}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button onClick={() => setWicketOpen(true)} disabled={runDisabled} className="btn bg-coral/15 text-coral hover:bg-coral/25 disabled:opacity-30">
                <Ban size={15} /> Wicket
              </button>
              <button onClick={() => setExtraOpen(true)} disabled={runDisabled} className="btn border border-amber-300/20 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 disabled:opacity-30">
                <CircleDot size={15} /> Extras
              </button>
              <button onClick={() => post("/undo", {}, "Last delivery undone")} disabled={Boolean(busy) || !live} className="btn-ghost">
                <Undo2 size={15} /> Undo
              </button>
              <button onClick={() => post("/swap-strike", {}, "Strike swapped")} disabled={runDisabled} className="btn-ghost">
                <ArrowLeftRight size={15} /> Swap strike
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Bowler" className="min-w-[180px] flex-1">
                  <select value={nextBowler} onChange={(event) => setNextBowler(event.target.value)} className="input !py-2 text-xs" disabled={!live}>
                    <option value="" className="bg-ink-900">Choose bowler</option>
                    {bowlingLineup.map((row) => {
                      const player = row.player;
                      return (
                        <option key={player?._id || row} value={idOf(player)} className="bg-ink-900">
                          {player?.name || "Player"} {idOf(player) === idOf(innings?.lastBowler) ? "(last over)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </Field>
                <button onClick={applyBowler} disabled={!live || !nextBowler || busy === "/bowler"} className="btn-ghost btn-xs">
                  {busy === "/bowler" ? <Loader2 size={13} className="animate-spin" /> : <UserRound size={13} />} Set bowler
                </button>
                <button onClick={() => setConfirm({ action: "innings" })} disabled={!live} className="btn-ghost btn-xs">
                  <Flag size={13} /> End innings
                </button>
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[10px] text-white/30">
                <Info size={11} className="mt-0.5 shrink-0" /> The engine auto-picks the next bowler and rotates the strike at the end of every over. Override any time.
              </p>
            </div>

            {actionError && <p className="mt-3 rounded-lg border border-coral/20 bg-coral/10 px-3 py-2 text-[11px] text-coral">{actionError}</p>}
          </Panel>

          <Panel title="Match control" subtitle="Careful — these affect everyone watching">
            <div className="grid gap-2 sm:grid-cols-3">
              <button onClick={() => setConfirm({ action: "start" })} disabled={!["upcoming", "abandoned"].includes(match.status)} className="btn-ghost btn-xs">
                <Play size={13} /> Start match
              </button>
              <button onClick={() => setConfirm({ action: "finish" })} disabled={finished || match.status === "upcoming"} className="btn-ghost btn-xs">
                <Flag size={13} /> Finish match
              </button>
              <button onClick={() => setConfirm({ action: "reset" })} className="btn-danger btn-xs">
                <RotateCcw size={13} /> Reset scorecard
              </button>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[10px] text-white/30">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" /> Finishing publishes the result and picks a player of the match automatically. Reset deletes every delivery.
            </p>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Commentary" subtitle="Add a note to the live feed" bodyClassName="space-y-2">
            <textarea
              value={commentary}
              onChange={(event) => setCommentary(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Rain arrives, players walk off…"
              className="input resize-none text-xs"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-white/25">{commentary.length}/500</span>
              <button onClick={submitCommentary} disabled={!commentary.trim() || Boolean(busy)} className="btn-primary btn-xs">
                {busy === "/commentary" ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />} Post
              </button>
            </div>
          </Panel>

          <Panel title="Ball-by-ball feed" subtitle="Newest first · powers the public commentary" bodyClassName="!p-0">
            <div className="max-h-[520px] overflow-y-auto">
              {balls.length ? (
                [...balls].reverse().map((ball) => (
                  <div key={ball._id} className="flex gap-2.5 border-b border-white/[0.05] px-4 py-2.5 last:border-0">
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                        ball.wicket?.isWicket
                          ? "bg-coral/20 text-coral"
                          : ballLabel(ball) === "4" || ballLabel(ball) === "6"
                            ? "bg-lime/20 text-lime"
                            : ball.extraType
                              ? "bg-amber-400/15 text-amber-200"
                              : "bg-white/[0.06] text-white/50"
                      )}
                    >
                      {ballLabel(ball)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] leading-relaxed text-white/60">{ball.commentary}</p>
                      <p className="mt-0.5 text-[9px] text-white/25">
                        {ball.scoreAfter?.over} ov · {ball.scoreAfter?.runs}/{ball.scoreAfter?.wickets} · {ball.isLegal ? "legal" : "extra"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="px-4 py-10 text-center text-xs text-white/30">No deliveries yet. The feed fills as you score.</p>
              )}
            </div>
          </Panel>

          <Panel title="Current innings" subtitle="Live scorecard snapshot" bodyClassName="space-y-2">
            {innings ? (
              <>
                <div className="flex items-center justify-between text-[11px]"><span className="text-white/35">Batting</span><span className="font-semibold text-white/75">{teamName(battingTeam)}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="text-white/35">Extras</span><span className="font-mono text-white/70">{Object.values(innings.extras || {}).reduce((sum, value) => sum + Number(value || 0), 0)}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="text-white/35">Partnership</span><span className="font-mono text-white/70">{innings.partnerships?.find((row) => row.unbroken)?.runs || 0}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="text-white/35">Last wicket</span><span className="max-w-[180px] truncate text-white/70">{innings.fow?.length ? innings.fow[innings.fow.length - 1].text : "—"}</span></div>
                <div className="flex items-center justify-between text-[11px]"><span className="text-white/35">Free hit</span><span className={innings.freeHit ? "font-semibold text-lime" : "text-white/40"}>{innings.freeHit ? "Yes" : "No"}</span></div>
              </>
            ) : (
              <p className="py-3 text-center text-[11px] text-white/30">Innings has not started.</p>
            )}
          </Panel>
        </div>
      </div>

      <Modal
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        title="Record a wicket"
        subtitle="The next batter and striker are handled automatically."
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost btn-xs" onClick={() => setWicketOpen(false)}>Cancel</button>
            <button onClick={submitWicket} disabled={Boolean(busy)} className="btn bg-coral text-white hover:bg-coral/85">
              {busy === "/ball" ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Record wicket
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Dismissal type" required>
            <select value={wicket.type} onChange={(event) => setWicket({ ...wicket, type: event.target.value })} className="input">
              {WICKET_TYPES.map((row) => (
                <option key={row.value} value={row.value} className="bg-ink-900">{row.label}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "striker", label: `Striker · ${strikerPlayer?.name || "—"}` },
              { value: "nonStriker", label: `Non-striker · ${nonStrikerPlayer?.name || "—"}` },
            ].map((row) => (
              <button
                key={row.value}
                type="button"
                onClick={() => setWicket({ ...wicket, outBatsman: row.value })}
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-left text-[11px] font-semibold transition",
                  wicket.outBatsman === row.value ? "border-coral/40 bg-coral/10 text-coral" : "border-white/10 bg-white/[0.02] text-white/50"
                )}
              >
                {row.label}
              </button>
            ))}
          </div>
          {["caught", "runOut", "stumped"].includes(wicket.type) && (
            <Field label="Fielder" hint="Catches and stumpings default to the designated keeper">
              <select value={wicket.fielder} onChange={(event) => setWicket({ ...wicket, fielder: event.target.value })} className="input">
                <option value="" className="bg-ink-900">No fielder / automatic</option>
                {fielders.map((player) => (
                  <option key={player._id} value={player._id} className="bg-ink-900">{player.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Runs completed before the wicket" hint="Useful for run outs">
            <select value={wicket.batRuns} onChange={(event) => setWicket({ ...wicket, batRuns: event.target.value })} className="input">
              {[0, 1, 2, 3, 4, 5, 6].map((run) => (
                <option key={run} value={run} className="bg-ink-900">{run} run{run === 1 ? "" : "s"}</option>
              ))}
            </select>
          </Field>
          <Field label="Next batter" hint="Leave automatic to use the next player in the batting order">
            <select value={wicket.newBatsman} onChange={(event) => setWicket({ ...wicket, newBatsman: event.target.value })} className="input">
              <option value="" className="bg-ink-900">Automatic</option>
              {availableBatsmen.map((row) => (
                <option key={idOf(row.player)} value={idOf(row.player)} className="bg-ink-900">
                  {row.player?.name || "Batter"} (batting at {row.position + 1})
                </option>
              ))}
            </select>
          </Field>
          {availableBatsmen.length === 0 && (
            <p className="rounded-lg border border-amber-300/20 bg-amber-400/[0.07] px-3 py-2 text-[10px] text-amber-200/80">
              No new batter is available — this delivery may end the innings.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={extraOpen}
        onClose={() => setExtraOpen(false)}
        title="Add extras"
        subtitle="Wides and no balls do not count as legal deliveries."
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost btn-xs" onClick={() => setExtraOpen(false)}>Cancel</button>
            <button onClick={submitExtra} disabled={Boolean(busy)} className="btn-primary btn-xs">
              {busy === "/ball" ? <Loader2 size={13} className="animate-spin" /> : <CircleDot size={13} />} Add extra
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EXTRAS.map((row) => (
              <button
                key={row.value}
                type="button"
                onClick={() =>
                  setExtra({
                    type: row.value,
                    runs: row.value === "wide" || row.value === "noBall" ? 1 : 1,
                    batRuns: 0,
                  })
                }
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition",
                  extra.type === row.value
                    ? "border-amber-300/40 bg-amber-400/10 text-amber-200"
                    : "border-white/10 bg-white/[0.02] text-white/50"
                )}
              >
                {row.label} <span className="text-white/25">({row.short})</span>
              </button>
            ))}
          </div>
          <Field label="Extra runs" hint={extra.type === "wide" || extra.type === "noBall" ? "Includes the automatic 1 penalty run" : "Runs run by the batters"}>
            <select value={extra.runs} onChange={(event) => setExtra({ ...extra, runs: Number(event.target.value) })} className="input">
              {[1, 2, 3, 4, 5, 6, 7].map((run) => (
                <option key={run} value={run} className="bg-ink-900">{run}</option>
              ))}
            </select>
          </Field>
          {extra.type === "noBall" && (
            <Field label="Runs off the bat" hint="No ball + bat runs count together">
              <select value={extra.batRuns} onChange={(event) => setExtra({ ...extra, batRuns: Number(event.target.value) })} className="input">
                {[0, 1, 2, 3, 4, 5, 6].map((run) => (
                  <option key={run} value={run} className="bg-ink-900">{run}</option>
                ))}
              </select>
            </Field>
          )}
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] leading-relaxed text-white/35">
            {extra.type === "wide"
              ? "Wide: 1 extra run (plus any runs run). The ball is replayed and the striker stays on strike unless the batters cross."
              : extra.type === "noBall"
                ? "No ball: the next delivery is a free hit. Bat runs are added to the striker's score."
                : extra.type === "penalty"
                  ? "Penalty runs are added to the team total and do not consume a delivery."
                  : "Byes and leg byes are added to the team total but not the batter's runs."}
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => (busy ? null : setConfirm(null))}
        onConfirm={runConfirm}
        title={confirmCopy.title}
        text={confirmCopy.text}
        confirmLabel={confirmCopy.label}
        danger={confirmCopy.danger}
        loading={Boolean(busy)}
      />
    </AdminPage>
  );
}
