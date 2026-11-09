import Match from "../models/Match.model.js";
import Ball from "../models/Ball.model.js";
import ApiError from "../utils/ApiError.js";
import { EXTRA_TYPES, WICKET_TYPES } from "../utils/constants.js";
import { ballsToOvers, dismissalText } from "../utils/format.js";
import { notify } from "../realtime/emit.js";

const idOf = (ref) => String(ref?._id || ref || "");
const clone = (value) => JSON.parse(JSON.stringify(value));

const NON_BOWLER_WICKETS = new Set([
  "runOut",
  "retired",
  "obstructing",
  "timedOut",
  "handledBall",
  "hitTheBallTwice",
]);

const SLOT = (match, teamId) => (idOf(match.teamA) === idOf(teamId) ? "A" : "B");
const otherSlot = (slot) => (slot === "A" ? "B" : "A");

const teamName = (match, teamId) => {
  if (idOf(match.teamA) === idOf(teamId)) return match.teamA?.name || "Team A";
  if (idOf(match.teamB) === idOf(teamId)) return match.teamB?.name || "Team B";
  return "Team";
};

const teamShort = (match, teamId) => {
  if (idOf(match.teamA) === idOf(teamId)) return match.teamA?.shortName || "A";
  if (idOf(match.teamB) === idOf(teamId)) return match.teamB?.shortName || "B";
  return "T";
};

const lineupFor = (match, slot) => [...(match.lineups?.[slot] || [])].sort((a, b) => a.order - b.order);

const allPlayers = (match) => {
  const map = new Map();
  for (const slot of ["A", "B"]) {
    for (const entry of lineupFor(match, slot)) {
      if (entry.player && typeof entry.player === "object") map.set(idOf(entry.player), entry.player);
    }
  }
  return map;
};

const playerName = (match, playerId) => {
  const map = allPlayers(match);
  return map.get(idOf(playerId))?.name || "Player";
};

const pickOpeningBowler = (match, bowlingSlot) => {
  const entries = lineupFor(match, bowlingSlot);
  if (!entries.length) return null;
  const bowlers = entries.filter((e) => {
    const role = e.player?.role || "";
    return role === "Bowler" || role === "All-Rounder";
  });
  const choice = (bowlers.length ? bowlers : entries.slice(-2))[0];
  return idOf(choice.player);
};

const pickNextBowler = (match, innings, bowlingSlot) => {
  const entries = lineupFor(match, bowlingSlot);
  if (!entries.length) return null;
  const last = idOf(innings.lastBowler || innings.bowler);
  const candidates = entries.filter((e) => idOf(e.player) !== last);
  const pool = candidates.length ? candidates : entries;
  const scored = pool
    .map((entry) => {
      const bowled = innings.bowling.find((b) => idOf(b.player) === idOf(entry.player));
      const role = entry.player?.role || "";
      const preference = idOf(entry.player) === idOf(innings.bowler) ? 5 : role === "Bowler" ? 0 : role === "All-Rounder" ? 1 : 3;
      return { entry, balls: bowled?.balls || 0, preference };
    })
    .sort((a, b) => a.balls - b.balls || a.preference - b.preference);
  return idOf(scored[0].entry.player);
};

const ensureBowlingEntry = (innings, playerId) => {
  let entry = innings.bowling.find((b) => idOf(b.player) === idOf(playerId));
  if (!entry) {
    innings.bowling.push({ player: playerId, balls: 0, maidens: 0, runs: 0, wickets: 0 });
    entry = innings.bowling[innings.bowling.length - 1];
  }
  return entry;
};

const availableBatsman = (match, innings) => {
  const atCrease = new Set([idOf(innings.striker), idOf(innings.nonStriker)]);
  const candidate = innings.batting
    .filter((b) => !b.out && b.balls === 0 && !atCrease.has(idOf(b.player)))
    .sort((a, b) => a.position - b.position)[0];
  return candidate ? idOf(candidate.player) : null;
};

const currentPartnership = (innings) => innings.partnerships.find((p) => p.unbroken);

const startPartnership = (innings) => {
  const existing = currentPartnership(innings);
  if (existing) existing.unbroken = false;
  innings.partnerships.push({
    playerA: innings.striker,
    playerB: innings.nonStriker,
    runs: 0,
    balls: 0,
    unbroken: true,
  });
};

const makeDismissal = (match, innings, wicket, bowlerId) => {
  const type = wicket?.type;
  if (!type || !WICKET_TYPES.includes(type)) throw ApiError.badRequest("Choose a valid dismissal type");
  const players = allPlayers(match);
  const fielder = wicket?.fielder ? players.get(String(wicket.fielder)) : null;
  const bowler = bowlerId ? players.get(String(bowlerId)) : null;
  let keeper = null;
  if (type === "stumped" || type === "caught") {
    const bowlingSlot = SLOT(match, innings.bowlingTeam);
    keeper = lineupFor(match, bowlingSlot).find((e) => e.isKeeper)?.player || null;
  }
  const text = dismissalText({ kind: type, bowler, fielder, keeper });
  return { kind: type, text, bowler: bowlerId || undefined, fielder: fielder?._id || undefined };
};

const batsmanOutId = (payload, originalStriker, originalNonStriker) =>
  payload?.wicket?.outBatsman === "nonStriker" ? originalNonStriker : originalStriker;

const closeInnings = (match, innings, reason) => {
  innings.completed = true;
  innings.endedAt = new Date();
  return reason;
};

const pickPlayerOfMatch = (match) => {
  const points = new Map();
  for (const innings of match.innings) {
    for (const bat of innings.batting) {
      const id = idOf(bat.player);
      const value = bat.runs + bat.fours + bat.sixes * 2 + (bat.balls >= 10 ? 5 : 0);
      points.set(id, (points.get(id) || 0) + value);
    }
    for (const bowl of innings.bowling) {
      const id = idOf(bowl.player);
      points.set(id, (points.get(id) || 0) + bowl.wickets * 22 + bowl.maidens * 4);
    }
    for (const fow of innings.fow) {
      // direct catches / run outs are reflected in dismissal metadata
      const dismissal = innings.batting.find((b) => idOf(b.player) === idOf(fow.player))?.dismissal;
      if (dismissal?.fielder) {
        const id = idOf(dismissal.fielder);
        points.set(id, (points.get(id) || 0) + (dismissal.kind === "runOut" ? 8 : 10));
      }
    }
  }
  let best = null;
  let bestScore = -1;
  for (const [id, score] of points.entries()) {
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
};

export const computeResult = (match) => {
  const [first, second] = match.innings;
  if (!first) return { text: "Match ended", tie: false };
  const firstTeam = first.battingTeam;
  const secondTeam = first.bowlingTeam;

  if (!second) {
    return {
      winner: null,
      winnerName: "",
      margin: "",
      text: "Match ended",
      tie: false,
    };
  }

  const firstName = teamName(match, firstTeam);
  const secondName = teamName(match, secondTeam);
  const target = second.target || first.runs + 1;

  if (second.runs >= target) {
    const size = lineupFor(match, SLOT(match, secondTeam)).length || 11;
    const wicketsLeft = Math.max(0, size - 1 - second.wickets);
    const ballsLeft = Math.max(0, match.overs * 6 - second.balls);
    const margin = `${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}${
      ballsLeft > 0 ? ` (${ballsLeft} ball${ballsLeft === 1 ? "" : "s"} remaining)` : ""
    }`;
    return {
      winner: secondTeam,
      winnerName: secondName,
      margin,
      text: `${secondName} won by ${margin}`,
      tie: false,
    };
  }

  if (second.runs === first.runs) {
    return {
      winner: null,
      winnerName: "",
      margin: "Match tied",
      text: "Match tied",
      tie: true,
    };
  }

  const margin = `${first.runs - second.runs} run${first.runs - second.runs === 1 ? "" : "s"}`;
  return {
    winner: firstTeam,
    winnerName: firstName,
    margin,
    text: `${firstName} won by ${margin}`,
    tie: false,
  };
};

export const finishMatch = (match, { manualText = "", status = "finished" } = {}) => {
  match.status = status;
  const result = computeResult(match);
  match.result = {
    ...result,
    text: manualText || result.text,
    margin: manualText ? "" : result.margin,
  };
  const pom = pickPlayerOfMatch(match);
  if (pom) match.playerOfMatch = pom;
  const stream = match.stream;
  if (stream?.isLive) {
    stream.isLive = false;
    stream.endedAt = new Date();
  }
  if (match.innings?.length) {
    for (const inn of match.innings) {
      if (!inn.completed) {
        inn.completed = true;
        inn.endedAt = new Date();
      }
    }
  }
  notify({
    type: "result",
    title: "Match finished",
    body: match.result.text || "Match has ended",
    matchId: match._id,
    icon: "trophy",
  });
  return match;
};

export const createInnings = (match, { battingTeam, bowlingTeam, number, target = null }) => {
  const battingSlot = SLOT(match, battingTeam);
  const bowlingSlot = otherSlot(battingSlot);
  const battingLineup = lineupFor(match, battingSlot);

  const innings = {
    number,
    battingTeam,
    bowlingTeam,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
    batting: battingLineup.map((entry, index) => ({
      player: entry.player?._id || entry.player,
      position: index,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      out: false,
      dismissal: {},
    })),
    bowling: lineupFor(match, bowlingSlot).map((entry) => ({
      player: entry.player?._id || entry.player,
      balls: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      wides: 0,
      noBalls: 0,
    })),
    fow: [],
    overs: [],
    partnerships: [],
    striker: battingLineup[0]?.player?._id || battingLineup[0]?.player || null,
    nonStriker: battingLineup[1]?.player?._id || battingLineup[1]?.player || null,
    bowler: pickOpeningBowler(match, bowlingSlot),
    lastBowler: null,
    needsBowler: false,
    freeHit: false,
    target,
    completed: false,
    startedAt: new Date(),
  };
  if (!innings.striker || !innings.nonStriker) {
    throw ApiError.badRequest("Both teams need at least 2 players in the batting line-up");
  }
  innings.partnerships.push({
    playerA: innings.striker,
    playerB: innings.nonStriker,
    runs: 0,
    balls: 0,
    unbroken: true,
  });
  match.innings.push(innings);
  match.currentInnings = number;
  if (target) match.target = target;
  return innings;
};

export const startMatch = (match, { status = "live" } = {}) => {
  const aCount = lineupFor(match, "A").length;
  const bCount = lineupFor(match, "B").length;
  if (aCount < 2 || bCount < 2) throw ApiError.badRequest("Both teams need at least 2 players before starting");

  if (!match.toss?.winnerSlot) {
    match.toss = { winnerSlot: "A", decision: "bat", text: `${teamName(match, match.teamA)} won the toss and chose to bat` };
  }
  const battingSlot = match.toss.decision === "bowl" ? otherSlot(match.toss.winnerSlot) : match.toss.winnerSlot;
  const battingTeam = battingSlot === "A" ? match.teamA?._id || match.teamA : match.teamB?._id || match.teamB;
  const bowlingTeam = battingSlot === "A" ? match.teamB?._id || match.teamB : match.teamA?._id || match.teamA;

  match.status = status;
  match.innings = [];
  match.result = {};
  match.target = null;
  match.undoStack = [];
  match.startTime = match.startTime || new Date();
  createInnings(match, { battingTeam, bowlingTeam, number: 0 });
  notify({
    type: "match-start",
    title: "Match is live",
    body: `${match.teamA?.shortName || "Team A"} vs ${match.teamB?.shortName || "Team B"} · ${match.series}`,
    matchId: match._id,
    icon: "live",
  });
  return match;
};

const commentaryFor = ({ overText, bowlerName, batsmanName, batRuns, extraType, extraRuns, wicket }) => {
  const prefix = `${overText} · ${bowlerName} to ${batsmanName}`;
  if (wicket?.isWicket) {
    return `${prefix} — WICKET! ${wicket.type === "runOut" ? "Run out" : "Gone"}. ${wicket.text}`;
  }
  if (extraType === "wide") return `${prefix} — wide${extraRuns > 1 ? `, ${extraRuns} runs` : ""}.`;
  if (extraType === "noBall")
    return `${prefix} — no ball${batRuns ? `, ${batRuns} run${batRuns > 1 ? "s" : ""} off the bat` : ""}.`;
  if (extraType === "bye") return `${prefix} — ${extraRuns} bye${extraRuns > 1 ? "s" : ""}.`;
  if (extraType === "legBye") return `${prefix} — ${extraRuns} leg bye${extraRuns > 1 ? "s" : ""}.`;
  if (extraType === "penalty") return `${prefix} — ${extraRuns} penalty runs.`;
  if (batRuns === 6) return `${prefix} — SIX! That has gone all the way.`;
  if (batRuns === 4) return `${prefix} — FOUR! Beautifully timed.`;
  if (batRuns === 0) return `${prefix} — no run.`;
  if (batRuns === 1) return `${prefix} — single taken.`;
  if (batRuns === 2) return `${prefix} — two runs.`;
  if (batRuns === 3) return `${prefix} — three runs, good running.`;
  if (batRuns === 5) return `${prefix} — five runs!`;
  return `${prefix} — ${batRuns} runs.`;
};

export const applyBall = async (match, payload, user) => {
  if (match.status !== "live") throw ApiError.badRequest("Start the match before adding deliveries");
  const innings = match.innings[match.currentInnings];
  if (!innings || innings.completed) throw ApiError.badRequest("This innings is already complete");
  if (innings.needsBowler && !payload.bowler) throw ApiError.badRequest("Select a bowler for the next over");

  const originalStriker = innings.striker;
  const originalNonStriker = innings.nonStriker;
  const strikerId = idOf(originalStriker);
  const nonStrikerId = idOf(originalNonStriker);

  if (payload.bowler) {
    const exists = lineupFor(match, SLOT(match, innings.bowlingTeam)).some(
      (e) => idOf(e.player) === String(payload.bowler)
    );
    if (exists) innings.bowler = payload.bowler;
  }
  if (!innings.bowler) {
    innings.bowler = pickOpeningBowler(match, SLOT(match, innings.bowlingTeam));
    if (!innings.bowler) throw ApiError.badRequest("Add bowlers to the bowling line-up first");
  }
  const bowlerId = idOf(innings.bowler);

  let batRuns = Number(payload.batRuns ?? 0);
  if (!Number.isInteger(batRuns) || batRuns < 0 || batRuns > 6) {
    throw ApiError.badRequest("Runs off the bat must be a whole number between 0 and 6");
  }

  const extraType = EXTRA_TYPES.includes(payload.extra?.type) ? payload.extra.type : "";
  let extraRuns = 0;
  if (extraType) {
    const minimum = extraType === "wide" || extraType === "noBall" ? 1 : 0;
    extraRuns = Number(payload.extra?.runs ?? minimum);
    if (!Number.isInteger(extraRuns) || extraRuns < minimum || extraRuns > 7) {
      throw ApiError.badRequest("Check the extra runs value");
    }
  }
  if (extraType === "wide" && batRuns > 0) throw ApiError.badRequest("A wide cannot have runs off the bat");
  if ((extraType === "bye" || extraType === "legBye") && batRuns > 0) {
    throw ApiError.badRequest("Byes and leg byes cannot have runs off the bat");
  }

  const wicket = payload.wicket?.type ? payload.wicket : null;
  if (wicket && !WICKET_TYPES.includes(wicket.type)) throw ApiError.badRequest("Invalid dismissal type");
  if (wicket && innings.freeHit && !["runOut", "obstructing", "retired"].includes(wicket.type)) {
    throw ApiError.badRequest("Only a run out can dismiss a batter on a free hit");
  }
  if (wicket?.type === "retired") {
    // retired is not a team wicket
  }

  const isWide = extraType === "wide";
  const isNoBall = extraType === "noBall";
  const isPenalty = extraType === "penalty";
  const isBye = extraType === "bye";
  const isLegBye = extraType === "legBye";
  const isLegal = !isWide && !isNoBall && !isPenalty;
  const totalRuns = batRuns + (extraType ? extraRuns : 0);
  const ranRuns = isWide
    ? Math.max(0, extraRuns - 1) + batRuns
    : isNoBall
      ? batRuns + Math.max(0, extraRuns - 1)
      : isBye || isLegBye
        ? extraRuns
        : extraType === "penalty"
          ? 0
          : batRuns;

  const snapshot = {
    innings: clone(match.innings),
    currentInnings: match.currentInnings,
    status: match.status,
    target: match.target,
    result: clone(match.result || {}),
    savedAt: new Date().toISOString(),
  };

  const striker = innings.batting.find((b) => idOf(b.player) === strikerId);
  if (!striker) throw ApiError.badRequest("Striker is missing from the scorecard");
  const bowler = ensureBowlingEntry(innings, innings.bowler);

  // ── batter ────────────────────────────────────────────────
  striker.runs += batRuns;
  if (!isWide) striker.balls += 1;
  if (batRuns === 4) striker.fours += 1;
  if (batRuns === 6) striker.sixes += 1;

  // ── bowler & extras ───────────────────────────────────────
  if (isLegal) bowler.balls += 1;
  if (isWide) {
    bowler.runs += extraRuns;
    bowler.wides += extraRuns;
    innings.extras.wides += extraRuns;
  } else if (isNoBall) {
    bowler.runs += extraRuns + batRuns;
    bowler.noBalls += extraRuns;
    innings.extras.noBalls += extraRuns;
  } else if (isBye) {
    innings.extras.byes += extraRuns;
  } else if (isLegBye) {
    innings.extras.legByes += extraRuns;
  } else if (isPenalty) {
    innings.extras.penalty += extraRuns;
  } else {
    bowler.runs += batRuns;
  }

  const overNumber = Math.floor(innings.balls / 6) + 1;
  let over = innings.overs.find((o) => o.number === overNumber);
  if (!over) {
    innings.overs.push({ number: overNumber, runs: 0, wickets: 0, conceded: 0, balls: [], bowler: innings.bowler });
    over = innings.overs[innings.overs.length - 1];
  }

  const ballInOver = (innings.balls % 6) + 1;
  innings.runs += totalRuns;
  if (isLegal) innings.balls += 1;

  // ── wicket ────────────────────────────────────────────────
  const wasFreeHit = Boolean(innings.freeHit);
  let wicketInfo = null;
  let inningsShort = false;
  if (wicket) {
    let outId = batsmanOutId(wicket, strikerId, nonStrikerId);
    if (!tournamentHasPlayer(match, outId)) throw ApiError.badRequest("Out batter could not be resolved");

    // completed runs happen before the run out is completed
    if (ranRuns % 2 === 1) {
      const tmp = innings.striker;
      innings.striker = innings.nonStriker;
      innings.nonStriker = tmp;
    }

    const outEntry = innings.batting.find((b) => idOf(b.player) === outId);
    if (!outEntry || outEntry.out) throw ApiError.badRequest("That batter is already out");
    const dismissal = makeDismissal(match, innings, wicket, bowlerId);
    outEntry.out = true;
    outEntry.dismissal = dismissal;

    if (wicket.type !== "retired") {
      innings.wickets += 1;
      over.wickets += 1;
      if (!NON_BOWLER_WICKETS.has(wicket.type)) bowler.wickets += 1;
    }

    innings.fow.push({
      wicket: innings.wickets,
      runs: innings.runs,
      balls: innings.balls,
      over: ballsToOvers(innings.balls),
      player: outId,
      text: dismissal.text,
    });

    const partnerId = outId === idOf(innings.striker) ? idOf(innings.nonStriker) : idOf(innings.striker);
    const nextId = wicket.newBatsman
      ? String(wicket.newBatsman)
      : availableBatsman(match, innings);
    const nextEntry = nextId
      ? innings.batting.find((b) => idOf(b.player) === nextId && !b.out)
      : null;

    if (nextEntry) {
      if (outId === idOf(innings.striker)) innings.striker = nextEntry.player;
      else innings.nonStriker = nextEntry.player;
    } else {
      innings.striker = partnerId || innings.striker;
      innings.nonStriker = null;
      inningsShort = true;
    }

    const livePartnership = currentPartnership(innings);
    if (livePartnership) livePartnership.unbroken = false;
    if (nextEntry) startPartnership(innings);

    wicketInfo = {
      isWicket: true,
      type: wicket.type,
      player: outId,
      text: dismissal.text,
      fielder: dismissal.fielder,
    };

    notify({
      type: "wicket",
      title: `WICKET! ${playerName(match, outId)}`,
      body: `${teamShort(match, innings.battingTeam)} ${innings.runs}/${innings.wickets} (${ballsToOvers(innings.balls)} ov) · ${dismissal.text}`,
      matchId: match._id,
      icon: "wicket",
    });
  } else {
    const partnership = currentPartnership(innings);
    if (partnership) {
      partnership.runs += totalRuns;
      if (isLegal) partnership.balls += 1;
    }
    if (ranRuns % 2 === 1) {
      const tmp = innings.striker;
      innings.striker = innings.nonStriker;
      innings.nonStriker = tmp;
    }
  }

  // ── milestone notes ───────────────────────────────────────
  if (striker.runs >= 100 && striker.runs - batRuns < 100) {
    notify({
      type: "century",
      title: `💯 ${playerName(match, strikerId)} century!`,
      body: `${striker.runs} runs from ${striker.balls} balls`,
      matchId: match._id,
      icon: "bat",
    });
  } else if (striker.runs >= 50 && striker.runs - batRuns < 50) {
    notify({
      type: "fifty",
      title: `${playerName(match, strikerId)} brings up fifty`,
      body: `${striker.runs} runs from ${striker.balls} balls`,
      matchId: match._id,
      icon: "bat",
    });
  }

  // ── ball feed record ──────────────────────────────────────
  const overText = `${overNumber - 1}.${((innings.balls - (isLegal ? 1 : 0)) % 6) + 1}`;
  const custom = typeof payload.commentary === "string" ? payload.commentary.trim().slice(0, 500) : "";
  const commentary =
    custom ||
    commentaryFor({
      overText,
      bowlerName: playerName(match, bowlerId),
      batsmanName: playerName(match, strikerId),
      batRuns,
      extraType,
      extraRuns,
      wicket: wicketInfo,
    });

  over.runs += totalRuns;
  over.conceded += batRuns + (isWide ? extraRuns : 0) + (isNoBall ? extraRuns : 0);
  over.balls.push({
    over: overNumber,
    ball: isLegal ? ballInOver : null,
    runs: totalRuns,
    extraType,
    isWicket: Boolean(wicketInfo),
    label: wicketInfo ? "W" : extraType === "wide" ? "Wd" : extraType === "noBall" ? "Nb" : extraType === "bye" ? "B" : extraType === "legBye" ? "Lb" : String(batRuns),
    batsman: strikerId,
    bowler: bowlerId,
    at: new Date(),
  });

  innings.freeHit = isNoBall;

  // ── completion, over & automatic strike rotation ──────────
  let event = "ball";
  const battingSize = lineupFor(match, SLOT(match, innings.battingTeam)).length || 11;
  const allOut = innings.wickets >= battingSize - 1 || inningsShort;
  const oversDone = innings.balls >= match.overs * 6;
  const targetReached = Boolean(innings.target && innings.runs >= innings.target);
  const inningsEnds = allOut || oversDone || targetReached;
  const overCompleted = isLegal && innings.balls % 6 === 0;

  if (overCompleted) {
    over.completed = true;
    if (over.conceded === 0) bowler.maidens += 1;
    if (!inningsEnds) {
      if (innings.striker && innings.nonStriker) {
        const tmp = innings.striker;
        innings.striker = innings.nonStriker;
        innings.nonStriker = tmp;
      }
      innings.lastBowler = innings.bowler;
      const nextBowler = pickNextBowler(match, innings, SLOT(match, innings.bowlingTeam));
      innings.bowler = nextBowler;
      innings.needsBowler = !nextBowler;
    }
  }

  const ballDoc = await Ball.create({
    match: match._id,
    innings: match.currentInnings,
    over: overNumber,
    ball: isLegal ? ballInOver : innings.balls % 6,
    batsman: strikerId,
    nonStriker: nonStrikerId,
    bowler: bowlerId,
    batRuns,
    extraType,
    extraRuns,
    totalRuns,
    isLegal,
    wicket: wicketInfo || {},
    commentary,
    scoreAfter: { runs: innings.runs, wickets: innings.wickets, balls: innings.balls, over: ballsToOvers(innings.balls) },
    isFreeHit: wasFreeHit,
    createdBy: user?._id,
  });

  if (innings.number === 0 && inningsEnds) {
    closeInnings(match, innings, allOut ? "all-out" : "overs");
    const second = createInnings(match, {
      battingTeam: innings.bowlingTeam,
      bowlingTeam: innings.battingTeam,
      number: 1,
      target: innings.runs + 1,
    });
    match.currentInnings = 1;
    match.status = "live";
    event = "innings-break";
    notify({
      type: "innings-break",
      title: "Innings break",
      body: `${teamName(match, second.battingTeam)} need ${second.target} to win from ${match.overs} overs`,
      matchId: match._id,
      icon: "live",
    });
  } else if (innings.number === 1 && inningsEnds) {
    closeInnings(match, innings, allOut ? "all-out" : "overs");
    finishMatch(match);
    event = "finished";
  }

  match.undoStack.push({ ...snapshot, ballId: ballDoc._id });
  if (match.undoStack.length > 30) match.undoStack = match.undoStack.slice(-30);
  match.markModified("innings");
  await match.save();

  return {
    match,
    ball: ballDoc.toObject(),
    commentary,
    event,
    strikeChanged: Boolean(
      wicket ? true : ranRuns % 2 === 1 || overCompleted
    ),
  };
};

const tournamentHasPlayer = (match, id) =>
  lineupFor(match, "A").some((e) => idOf(e.player) === String(id)) ||
  lineupFor(match, "B").some((e) => idOf(e.player) === String(id));

export const undoLastBall = async (match) => {
  if (!match.undoStack?.length) throw ApiError.badRequest("Nothing to undo");
  const last = match.undoStack.pop();
  if (last.ballId) {
    await Ball.deleteOne({ _id: last.ballId });
  }
  match.innings = last.innings;
  match.currentInnings = last.currentInnings;
  match.status = last.status;
  match.target = last.target;
  match.result = last.result;
  match.markModified("innings");
  match.markModified("undoStack");
  await match.save();
  return match;
};

export const setBowler = (match, playerId) => {
  const innings = match.innings[match.currentInnings];
  if (!innings) throw ApiError.badRequest("Match has not started");
  const allowed = lineupFor(match, SLOT(match, innings.bowlingTeam)).some((e) => idOf(e.player) === String(playerId));
  if (!allowed) throw ApiError.badRequest("That player is not in the bowling line-up");
  if (idOf(innings.lastBowler) === String(playerId)) {
    throw ApiError.badRequest("A bowler cannot bowl two overs in a row");
  }
  innings.bowler = playerId;
  innings.needsBowler = false;
  return match;
};

export const swapStrike = (match) => {
  const innings = match.innings[match.currentInnings];
  if (!innings || !innings.striker || !innings.nonStriker) throw ApiError.badRequest("Both batters must be at the crease");
  const tmp = innings.striker;
  innings.striker = innings.nonStriker;
  innings.nonStriker = tmp;
  return match;
};

export const endInnings = (match, { declared = false } = {}) => {
  const innings = match.innings[match.currentInnings];
  if (!innings) throw ApiError.badRequest("No active innings");
  innings.declared = declared;
  if (innings.number === 0) {
    closeInnings(match, innings, declared ? "declared" : "ended");
    createInnings(match, {
      battingTeam: innings.bowlingTeam,
      bowlingTeam: innings.battingTeam,
      number: 1,
      target: innings.runs + 1,
    });
    match.currentInnings = 1;
    match.status = "live";
  } else {
    closeInnings(match, innings, declared ? "declared" : "ended");
    finishMatch(match);
  }
  return match;
};

export const addManualCommentary = (match, { text, innings = match.currentInnings }) => {
  const inn = match.innings[innings];
  if (!inn) throw ApiError.badRequest("Innings not available");
  const over = inn.overs[inn.overs.length - 1];
  const event = {
    over: over?.number || Math.floor(inn.balls / 6) + 1,
    ball: inn.balls % 6,
    runs: 0,
    isWicket: false,
    label: "•",
    at: new Date(),
  };
  if (over) over.balls.push(event);
  return { commentary: text, event };
};

export { pickNextBowler, lineupFor, SLOT, teamName, teamShort };
