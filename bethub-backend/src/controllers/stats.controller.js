import Match from "../models/Match.model.js";
import Player from "../models/Player.model.js";
import Team from "../models/Team.model.js";
import Video from "../models/Video.model.js";
import Country from "../models/Country.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ballsToOvers, runRate, requiredRunRate } from "../utils/format.js";
import { matchSummary, teamMini, playerMini, MATCH_POPULATE } from "../services/serializers.js";

const round = (n, digits = 2) => Number(Number(n || 0).toFixed(digits));
const oversOf = (balls) => (balls || 0) / 6;

const liveMatchesQuery = { status: { $in: ["live", "innings-break"] } };

const matchPopulate = [
  { path: "teamA", populate: { path: "country" } },
  { path: "teamB", populate: { path: "country" } },
  { path: "innings.battingTeam" },
  { path: "innings.bowlingTeam" },
  { path: "innings.striker", populate: { path: "country" } },
  { path: "innings.nonStriker", populate: { path: "country" } },
  { path: "innings.bowler", populate: { path: "country" } },
];

export const overview = asyncHandler(async (_req, res) => {
  const [matches, players, teams, countries, videos, live, upcoming, finished, videoCount] = await Promise.all([
    Match.countDocuments(),
    Player.countDocuments({ isActive: true }),
    Team.countDocuments({ isActive: true }),
    Country.countDocuments({ isActive: true }),
    Video.countDocuments(),
    Match.find(liveMatchesQuery).sort({ "stream.isLive": -1, startTime: -1 }).limit(8).populate(matchPopulate),
    Match.find({ status: "upcoming" }).sort({ startTime: 1 }).limit(8).populate(matchPopulate),
    Match.find({ status: "finished" }).sort({ startTime: -1 }).limit(8).populate(matchPopulate),
    Video.countDocuments(),
  ]);

  const [recentResults, shorts, highlights, liveStreams, viewerAgg, viewAgg, series] = await Promise.all([
    Match.find({ status: "finished" }).sort({ startTime: -1 }).limit(6).populate(matchPopulate),
    Video.find({ type: "short" }).sort({ createdAt: -1 }).limit(10),
    Video.find({ type: { $in: ["highlight", "long"] } }).sort({ createdAt: -1 }).limit(6),
    Match.countDocuments({ "stream.isLive": true }),
    Match.aggregate([{ $match: { "stream.isLive": true } }, { $group: { _id: null, total: { $sum: "$stream.viewers" } } }]),
    Match.aggregate([{ $group: { _id: null, total: { $sum: "$views" }, stream: { $sum: "$stream.totalViews" } } }]),
    Match.aggregate([
      { $group: { _id: "$series", matches: { $sum: 1 }, latest: { $max: "$startTime" } } },
      { $sort: { latest: -1 } },
      { $limit: 12 },
    ]),
  ]);

  res.json({
    success: true,
    counts: {
      matches,
      players,
      teams,
      countries,
      videos: videoCount,
      live: live.length,
      liveStreams,
      viewers: viewerAgg[0]?.total || 0,
      views: viewAgg[0]?.total || 0,
      streamViews: viewAgg[0]?.stream || 0,
    },
    live: live.map(matchSummary),
    upcoming: upcoming.map(matchSummary),
    recent: recentResults.map(matchSummary),
    finished: finished.map(matchSummary),
    shorts,
    highlights,
    series: series.map((s) => ({ name: s._id, matches: s.matches, latest: s.latest })),
    serverTime: new Date().toISOString(),
  });
});

export const teamStandings = asyncHandler(async (req, res) => {
  const filter = { status: "finished" };
  if (req.query.series) filter.series = req.query.series;
  const matches = await Match.find(filter)
    .sort({ startTime: 1 })
    .populate([{ path: "teamA", populate: { path: "country" } }, { path: "teamB", populate: { path: "country" } }]);

  const table = new Map();
  const ensure = (team) => {
    if (!team) return null;
    const id = String(team._id);
    if (!table.has(id)) {
      table.set(id, {
        team: teamMini(team),
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        runsFor: 0,
        ballsFor: 0,
        runsAgainst: 0,
        ballsAgainst: 0,
        form: [],
        nrr: 0,
      });
    }
    return table.get(id);
  };

  for (const match of matches) {
    const a = ensure(match.teamA);
    const b = ensure(match.teamB);
    if (!a || !b) continue;
    a.played += 1;
    b.played += 1;

    const result = match.result || {};
    if (result.tie) {
      a.tied += 1;
      b.tied += 1;
      a.points += 1;
      b.points += 1;
      a.form.push("T");
      b.form.push("T");
    } else if (result.noResult) {
      a.noResult += 1;
      b.noResult += 1;
      a.points += 1;
      b.points += 1;
      a.form.push("NR");
      b.form.push("NR");
    } else if (result.winner) {
      const winnerId = String(result.winner);
      const winner = winnerId === String(match.teamA._id) ? a : b;
      const loser = winner === a ? b : a;
      winner.won += 1;
      winner.points += 2;
      winner.form.push("W");
      loser.lost += 1;
      loser.form.push("L");
    }

    const isTeamA = (id) => String(id) === String(match.teamA._id);
    for (const inn of match.innings || []) {
      const battingIsA = String(inn.battingTeam) === String(match.teamA._id);
      const batRow = battingIsA ? a : b;
      const bowlRow = battingIsA ? b : a;
      batRow.runsFor += inn.runs;
      batRow.ballsFor += inn.balls;
      bowlRow.runsAgainst += inn.runs;
      bowlRow.ballsAgainst += inn.balls;
    }
    void isTeamA;
  }

  const rows = [...table.values()]
    .map((row) => {
      const forRate = row.ballsFor ? (row.runsFor / row.ballsFor) * 6 : 0;
      const againstRate = row.ballsAgainst ? (row.runsAgainst / row.ballsAgainst) * 6 : 0;
      const nrr = row.ballsFor && row.ballsAgainst ? forRate - againstRate : 0;
      return {
        ...row,
        nrr: round(nrr, 3),
        runRate: round(forRate),
        form: row.form.slice(-5),
      };
    })
    .sort((x, y) => y.points - x.points || y.nrr - x.nrr || y.won - x.won);

  res.json({ success: true, table: rows, series: req.query.series || "All series" });
});

export const playerLeaderboard = asyncHandler(async (req, res) => {
  const type = ["runs", "wickets", "sixes", "fours", "strikeRate"].includes(req.query.type)
    ? req.query.type
    : "runs";
  const limit = Math.min(50, Number(req.query.limit) || 10);

  const [facet] = await Match.aggregate([
    { $match: { status: { $in: ["live", "finished"] } } },
    {
      $facet: {
        batting: [
          { $unwind: "$innings" },
          { $unwind: "$innings.batting" },
          {
            $group: {
              _id: "$innings.batting.player",
              runs: { $sum: "$innings.batting.runs" },
              balls: { $sum: "$innings.batting.balls" },
              fours: { $sum: "$innings.batting.fours" },
              sixes: { $sum: "$innings.batting.sixes" },
              innings: { $sum: 1 },
              notOuts: { $sum: { $cond: ["$innings.batting.out", 0, 1] } },
              highScore: { $max: "$innings.batting.runs" },
              lowScore: { $min: "$innings.batting.runs" },
              matchIds: { $addToSet: "$_id" },
            },
          },
        ],
        bowling: [
          { $unwind: "$innings" },
          { $unwind: "$innings.bowling" },
          {
            $group: {
              _id: "$innings.bowling.player",
              wickets: { $sum: "$innings.bowling.wickets" },
              balls: { $sum: "$innings.bowling.balls" },
              runsConceded: { $sum: "$innings.bowling.runs" },
              maidens: { $sum: "$innings.bowling.maidens" },
              bestWickets: { $max: "$innings.bowling.wickets" },
              matchIds: { $addToSet: "$_id" },
            },
          },
        ],
      },
    },
  ]);

  const map = new Map();
  const row = (id) => {
    if (!map.has(String(id))) {
      map.set(String(id), {
        playerId: String(id),
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        innings: 0,
        notOuts: 0,
        highScore: 0,
        lowScore: null,
        wickets: 0,
        bowlingBalls: 0,
        runsConceded: 0,
        maidens: 0,
        bestWickets: 0,
        matches: 0,
        matchIds: [],
      });
    }
    return map.get(String(id));
  };

  for (const b of facet.batting) {
    if (!b._id) continue;
    Object.assign(row(b._id), {
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      innings: b.innings,
      notOuts: b.notOuts,
      highScore: b.highScore,
      lowScore: b.lowScore,
      matchIds: b.matchIds,
      matches: new Set(b.matchIds.map(String)).size,
    });
  }
  for (const b of facet.bowling) {
    if (!b._id) continue;
    const target = row(b._id);
    target.wickets = b.wickets;
    target.bowlingBalls = b.balls;
    target.runsConceded = b.runsConceded;
    target.maidens = b.maidens;
    target.bestWickets = b.bestWickets;
    target.matches = new Set([...(target.matchIds || []).map(String), ...(b.matchIds || []).map(String)]).size;
  }

  const players = await Player.find({ _id: { $in: [...map.keys()] } }).populate("country");
  const playerMap = new Map(players.map((p) => [String(p._id), p]));

  let rows = [...map.values()]
    .filter((r) => playerMap.has(r.playerId))
    .map((r) => {
      const player = playerMap.get(r.playerId);
      return {
        ...r,
        player: playerMini(player),
        strikeRate: r.balls ? round((r.runs / r.balls) * 100) : 0,
        average: r.innings - r.notOuts > 0 ? round(r.runs / (r.innings - r.notOuts)) : r.runs,
        economy: r.bowlingBalls ? round((r.runsConceded / r.bowlingBalls) * 6) : 0,
        bowlingStrikeRate: r.wickets ? round(r.bowlingBalls / r.wickets) : 0,
      };
    });

  const sorters = {
    runs: (a, b) => b.runs - a.runs,
    wickets: (a, b) => b.wickets - a.wickets || b.bestWickets - a.bestWickets,
    sixes: (a, b) => b.sixes - a.sixes,
    fours: (a, b) => b.fours - a.fours,
    strikeRate: (a, b) => b.strikeRate - a.strikeRate,
  };
  rows = rows.sort(sorters[type]).slice(0, limit);

  res.json({ success: true, type, players: rows });
});

export const playerStats = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id).populate("country");
  if (!player) throw ApiError.notFound("Player not found");

  const [batAgg, bowlAgg, matches] = await Promise.all([
    Match.aggregate([
      { $match: { status: { $in: ["live", "finished"] } } },
      { $unwind: "$innings" },
      { $unwind: "$innings.batting" },
      { $match: { "innings.batting.player": player._id } },
      {
        $group: {
          _id: null,
          runs: { $sum: "$innings.batting.runs" },
          balls: { $sum: "$innings.batting.balls" },
          fours: { $sum: "$innings.batting.fours" },
          sixes: { $sum: "$innings.batting.sixes" },
          innings: { $sum: 1 },
          notOuts: { $sum: { $cond: ["$innings.batting.out", 0, 1] } },
          highScore: { $max: "$innings.batting.runs" },
        },
      },
    ]),
    Match.aggregate([
      { $match: { status: { $in: ["live", "finished"] } } },
      { $unwind: "$innings" },
      { $unwind: "$innings.bowling" },
      { $match: { "innings.bowling.player": player._id } },
      {
        $group: {
          _id: null,
          wickets: { $sum: "$innings.bowling.wickets" },
          balls: { $sum: "$innings.bowling.balls" },
          runs: { $sum: "$innings.bowling.runs" },
          maidens: { $sum: "$innings.bowling.maidens" },
          best: { $max: "$innings.bowling.wickets" },
        },
      },
    ]),
    Match.find({ "innings.batting.player": player._id })
      .sort({ startTime: -1 })
      .limit(10)
      .populate([{ path: "teamA", populate: { path: "country" } }, { path: "teamB", populate: { path: "country" } }])
      .select("teamA teamB series format status startTime result innings"),
  ]);

  const bat = batAgg[0] || { runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, notOuts: 0, highScore: 0 };
  const bowl = bowlAgg[0] || { wickets: 0, balls: 0, runs: 0, maidens: 0, best: 0 };

  res.json({
    success: true,
    player,
    stats: {
      batting: {
        ...bat,
        average: bat.innings - bat.notOuts > 0 ? round(bat.runs / (bat.innings - bat.notOuts)) : bat.runs,
        strikeRate: bat.balls ? round((bat.runs / bat.balls) * 100) : 0,
      },
      bowling: {
        ...bowl,
        average: bowl.wickets ? round(bowl.runs / bowl.wickets) : 0,
        economy: bowl.balls ? round((bowl.runs / bowl.balls) * 6) : 0,
        strikeRate: bowl.wickets ? round(bowl.balls / bowl.wickets) : 0,
      },
    },
    matches: matches.map((m) => {
      const inn = (m.innings || []).find((i) => (i.batting || []).some((b) => String(b.player) === String(player._id)));
      const batLine = inn?.batting?.find((b) => String(b.player) === String(player._id));
      const bowlLine = (m.innings || []).flatMap((i) => i.bowling || []).find((b) => String(b.player) === String(player._id));
      return {
        ...matchSummary(m),
        performance: {
          runs: batLine?.runs || 0,
          balls: batLine?.balls || 0,
          out: batLine?.out || false,
          wickets: bowlLine?.wickets || 0,
          bowlingRuns: bowlLine?.runs || 0,
        },
      };
    }),
  });
});

export const matchInsights = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id).populate(matchPopulate);
  if (!match) throw ApiError.notFound("Match not found");
  const inn = match.innings?.[match.currentInnings];
  if (!inn) return res.json({ success: true, insights: null });

  const ballsLeft = Math.max(0, match.overs * 6 - inn.balls);
  const target = inn.target || match.target;
  const required = target ? Math.max(0, target - inn.runs) : null;
  const wicketsLeft = Math.max(0, (match.lineups?.[String(inn.battingTeam) === String(match.teamA?._id) ? "A" : "B"]?.length || 11) - 1 - inn.wickets);

  let winProbability = 50;
  if (target) {
    if (required <= 0) winProbability = 100;
    else if (ballsLeft <= 0 || wicketsLeft <= 0) winProbability = 0;
    else {
      const rrr = requiredRunRate(required, ballsLeft);
      const crr = runRate(inn.runs, inn.balls);
      const pressure = (crr - rrr) * 5 + wicketsLeft * 1.6 - required * 0.15;
      winProbability = Math.max(2, Math.min(98, 50 + pressure));
    }
  } else {
    const crr = runRate(inn.runs, inn.balls);
    winProbability = Math.max(8, Math.min(92, 50 + (crr - 8) * 4));
  }

  const current = inn.partnerships?.find((p) => p.unbroken);
  const last5 = (inn.overs || []).slice(-5);
  const worm = (match.innings || []).map((i) => {
    let total = 0;
    const points = [{ over: 0, runs: 0, wickets: 0 }];
    for (const over of i.overs || []) {
      total += over.runs || 0;
      points.push({ over: over.number, runs: total, wickets: i.wickets || 0 });
    }
    return {
      innings: i.number,
      team: teamMini(i.battingTeam),
      runs: i.runs,
      wickets: i.wickets,
      balls: i.balls,
      points,
    };
  });

  res.json({
    success: true,
    insights: {
      winProbability: Math.round(winProbability),
      currentRunRate: runRate(inn.runs, inn.balls),
      requiredRunRate: required != null ? requiredRunRate(required, ballsLeft) : null,
      required,
      ballsLeft,
      wicketsLeft,
      target,
      projected: Math.round(runRate(inn.runs, inn.balls) * (match.overs * 6 / 6)),
      partnership: current
        ? {
            runs: current.runs,
            balls: current.balls,
            playerA: playerMini(current.playerA),
            playerB: playerMini(current.playerB),
          }
        : null,
      last5Runs: last5.reduce((sum, over) => sum + (over.runs || 0), 0),
      last5Overs: last5.map((over) => ({
        over: over.number,
        runs: over.runs,
        wickets: over.wickets,
        balls: over.balls?.map((b) => b.label),
      })),
      worm,
      oversLeft: ballsLeft / 6,
      currentOver: ballsToOvers(inn.balls),
    },
  });
});

export const seriesList = asyncHandler(async (_req, res) => {
  const rows = await Match.aggregate([
    { $group: { _id: "$series", matches: { $sum: 1 }, live: { $sum: { $cond: [{ $in: ["$status", ["live", "innings-break"]] }, 1, 0] } }, latest: { $max: "$startTime" } } },
    { $sort: { latest: -1 } },
  ]);
  res.json({ success: true, series: rows.map((r) => ({ name: r._id, matches: r.matches, live: r.live, latest: r.latest })) });
});

/**
 * Full auto-computed records + charts. Everything is derived from the scorecards,
 * so the numbers stay in sync with the live scorer without manual entry.
 */
export const analytics = asyncHandler(async (_req, res) => {
  const matches = await Match.find({ status: { $in: ["live", "finished"] } })
    .sort({ startTime: 1 })
    .populate(MATCH_POPULATE);

  const keyOf = (value) => String(value?._id || value || "");
  const playerRows = new Map();
  const teamRows = new Map();
  const timelineRows = new Map();
  const totals = { matches: matches.length, finished: 0, live: 0, runs: 0, wickets: 0, fours: 0, sixes: 0, views: 0, streamViews: 0 };
  let highestTeam = null;
  let lowestTeam = null;
  let highestIndividual = null;
  let lowestIndividual = null;
  let bestBowling = null;
  let mostSixesInnings = null;
  let mostFoursInnings = null;

  const ensureTeam = (team) => {
    const id = keyOf(team);
    if (!id) return null;
    if (!teamRows.has(id)) {
      teamRows.set(id, {
        team: teamMini(team),
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        winPct: 0,
        runsFor: 0,
        runsAgainst: 0,
        wicketsFor: 0,
        wicketsAgainst: 0,
        ballsFor: 0,
        ballsAgainst: 0,
        fours: 0,
        sixes: 0,
        highScore: 0,
        lowScore: null,
      });
    }
    return teamRows.get(id);
  };

  const ensurePlayer = (player) => {
    if (!player || typeof player === "string") return null;
    const id = keyOf(player);
    if (!playerRows.has(id)) {
      playerRows.set(id, {
        player: playerMini(player),
        matches: new Set(),
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        innings: 0,
        outs: 0,
        highScore: 0,
        lowScore: null,
        wickets: 0,
        bowlingBalls: 0,
        runsConceded: 0,
        bestWickets: 0,
        bestRuns: 0,
        catches: 0,
        pom: 0,
      });
    }
    return playerRows.get(id);
  };

  const scoreRecord = (current, candidate, mode = "high") => {
    if (!candidate) return current;
    if (!current) return candidate;
    if (mode === "high") return candidate.value > current.value ? candidate : current;
    return candidate.value < current.value ? candidate : current;
  };

  for (const match of matches) {
    const finished = match.status === "finished";
    if (finished) totals.finished += 1;
    else totals.live += 1;
    totals.views += match.views || 0;
    totals.streamViews += match.stream?.totalViews || 0;

    const teamA = ensureTeam(match.teamA);
    const teamB = ensureTeam(match.teamB);
    if (finished && teamA && teamB) {
      teamA.played += 1;
      teamB.played += 1;
      if (match.result?.tie) {
        teamA.tied += 1;
        teamB.tied += 1;
        teamA.points += 1;
        teamB.points += 1;
      } else if (match.result?.noResult) {
        teamA.noResult += 1;
        teamB.noResult += 1;
        teamA.points += 1;
        teamB.points += 1;
      } else if (match.result?.winner) {
        const winner = keyOf(match.result.winner) === keyOf(match.teamA) ? teamA : teamB;
        const loser = winner === teamA ? teamB : teamA;
        winner.won += 1;
        winner.points += 2;
        loser.lost += 1;
      }
    }

    for (const innings of match.innings || []) {
      const batTeam = ensureTeam(innings.battingTeam);
      const bowlTeam = ensureTeam(innings.bowlingTeam);
      const hasScore = (innings.balls || 0) > 0 || (innings.runs || 0) > 0;
      if (hasScore) {
        totals.runs += innings.runs || 0;
        totals.wickets += innings.wickets || 0;
        const teamNameValue = batTeam?.team?.shortName || batTeam?.team?.name || "Team";
        const opponent = bowlTeam?.team?.shortName || bowlTeam?.team?.name || "Opponent";
        const scoreLabel = `${innings.runs || 0}/${innings.wickets || 0}`;
        const teamRecord = {
          value: innings.runs || 0,
          team: batTeam?.team || teamMini(innings.battingTeam),
          opponent: bowlTeam?.team || teamMini(innings.bowlingTeam),
          runs: innings.runs || 0,
          wickets: innings.wickets || 0,
          balls: innings.balls || 0,
          overs: ballsToOvers(innings.balls || 0),
          label: `${teamNameValue} ${scoreLabel}`,
          detail: `vs ${opponent}`,
          matchId: match._id,
          date: match.startTime,
          series: match.series,
        };
        highestTeam = scoreRecord(highestTeam, teamRecord, "high");
        lowestTeam = scoreRecord(lowestTeam, teamRecord, "low");
        if (batTeam) {
          batTeam.runsFor += innings.runs || 0;
          batTeam.ballsFor += innings.balls || 0;
          batTeam.wicketsFor += innings.wickets || 0;
          batTeam.highScore = Math.max(batTeam.highScore || 0, innings.runs || 0);
          batTeam.lowScore = batTeam.lowScore == null ? innings.runs || 0 : Math.min(batTeam.lowScore, innings.runs || 0);
        }
        if (bowlTeam) {
          bowlTeam.runsAgainst += innings.runs || 0;
          bowlTeam.ballsAgainst += innings.balls || 0;
          bowlTeam.wicketsAgainst += innings.wickets || 0;
        }
      }

      for (const bat of innings.batting || []) {
        const player = ensurePlayer(bat.player);
        if (!player) continue;
        const playedInnings = (bat.balls || 0) > 0 || (bat.runs || 0) > 0 || bat.out;
        if (!playedInnings) continue;
        player.matches.add(keyOf(match._id));
        player.innings += 1;
        player.runs += bat.runs || 0;
        player.balls += bat.balls || 0;
        player.fours += bat.fours || 0;
        player.sixes += bat.sixes || 0;
        player.highScore = Math.max(player.highScore || 0, bat.runs || 0);
        player.lowScore = player.lowScore == null ? bat.runs || 0 : Math.min(player.lowScore, bat.runs || 0);
        if (bat.out) player.outs += 1;
        totals.fours += bat.fours || 0;
        totals.sixes += bat.sixes || 0;
        if (batTeam) {
          batTeam.fours += bat.fours || 0;
          batTeam.sixes += bat.sixes || 0;
        }

        const playerRecord = {
          value: bat.runs || 0,
          player: player.player,
          team: batTeam?.team || teamMini(innings.battingTeam),
          runs: bat.runs || 0,
          balls: bat.balls || 0,
          fours: bat.fours || 0,
          sixes: bat.sixes || 0,
          notOut: !bat.out,
          label: `${player.player?.name || "Player"} ${bat.runs || 0}${bat.out ? "" : "*"}`,
          detail: `${bat.balls || 0} balls · ${bat.fours || 0}x4 · ${bat.sixes || 0}x6`,
          matchId: match._id,
          date: match.startTime,
          series: match.series,
        };
        highestIndividual = scoreRecord(highestIndividual, playerRecord, "high");
        lowestIndividual = scoreRecord(lowestIndividual, playerRecord, "low");
        mostSixesInnings = scoreRecord(mostSixesInnings, { ...playerRecord, value: bat.sixes || 0, label: `${player.player?.name || "Player"} ${bat.sixes || 0} sixes` }, "high");
        mostFoursInnings = scoreRecord(mostFoursInnings, { ...playerRecord, value: bat.fours || 0, label: `${player.player?.name || "Player"} ${bat.fours || 0} fours` }, "high");

        if (bat.dismissal?.fielder) {
          const fielder = ensurePlayer(bat.dismissal.fielder);
          if (fielder) fielder.catches += 1;
        }
      }

      for (const bowl of innings.bowling || []) {
        const player = ensurePlayer(bowl.player);
        if (!player) continue;
        if (!(bowl.balls > 0 || bowl.wickets > 0 || bowl.runs > 0)) continue;
        player.matches.add(keyOf(match._id));
        player.wickets += bowl.wickets || 0;
        player.bowlingBalls += bowl.balls || 0;
        player.runsConceded += bowl.runs || 0;
        const better = (bowl.wickets || 0) > player.bestWickets || ((bowl.wickets || 0) === player.bestWickets && (bowl.runs || 0) < (player.bestRuns || Infinity));
        if (better) {
          player.bestWickets = bowl.wickets || 0;
          player.bestRuns = bowl.runs || 0;
        }
        const bowlingRecord = {
          value: bowl.wickets || 0,
          player: player.player,
          team: bowlTeam?.team || teamMini(innings.bowlingTeam),
          wickets: bowl.wickets || 0,
          runs: bowl.runs || 0,
          balls: bowl.balls || 0,
          label: `${player.player?.name || "Player"} ${bowl.wickets || 0}/${bowl.runs || 0}`,
          detail: `${ballsToOvers(bowl.balls || 0)} overs`,
          matchId: match._id,
          date: match.startTime,
          series: match.series,
        };
        const currentBest = bestBowling;
        if (
          !currentBest ||
          bowlingRecord.wickets > currentBest.wickets ||
          (bowlingRecord.wickets === currentBest.wickets && bowlingRecord.runs < currentBest.runs)
        ) {
          bestBowling = bowlingRecord;
        }
      }
    }

    if (finished) {
      const when = new Date(match.startTime || match.createdAt || Date.now());
      const key = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}`;
      if (!timelineRows.has(key)) {
        timelineRows.set(key, {
          key,
          label: when.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
          matches: 0,
          runs: 0,
          wickets: 0,
          fours: 0,
          sixes: 0,
          views: 0,
        });
      }
      const bucket = timelineRows.get(key);
      bucket.matches += 1;
      bucket.views += match.views || 0;
      for (const innings of match.innings || []) {
        bucket.runs += innings.runs || 0;
        bucket.wickets += innings.wickets || 0;
        for (const bat of innings.batting || []) {
          bucket.fours += bat.fours || 0;
          bucket.sixes += bat.sixes || 0;
        }
      }
    }

    if (match.playerOfMatch) {
      const pom = ensurePlayer(match.playerOfMatch);
      if (pom) pom.pom += 1;
    }
  }

  const finalPlayers = [...playerRows.values()].map((row) => ({
    ...row,
    matches: row.matches.size,
    strikeRate: row.balls ? round((row.runs / row.balls) * 100) : 0,
    average: row.outs ? round(row.runs / row.outs) : row.runs,
    economy: row.bowlingBalls ? round((row.runsConceded / row.bowlingBalls) * 6) : 0,
    bowlingStrikeRate: row.wickets ? round(row.bowlingBalls / row.wickets) : 0,
    bestBowling: row.bestWickets ? `${row.bestWickets}/${row.bestRuns}` : "—",
  }));

  const finalTeams = [...teamRows.values()]
    .map((row) => ({
      ...row,
      winPct: row.played ? round((row.won / row.played) * 100, 1) : 0,
      nrr: row.ballsFor && row.ballsAgainst
        ? round((row.runsFor / row.ballsFor) * 6 - (row.runsAgainst / row.ballsAgainst) * 6, 3)
        : 0,
      lowScore: row.lowScore == null ? 0 : row.lowScore,
    }))
    .sort((a, b) => b.winPct - a.winPct || b.played - a.played || b.runsFor - a.runsFor);

  const by = (key, limit = 8) => [...finalPlayers].sort((a, b) => b[key] - a[key]).slice(0, limit);
  const timeline = [...timelineRows.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12);

  res.json({
    success: true,
    generatedAt: new Date().toISOString(),
    totals,
    teams: finalTeams,
    players: {
      topRuns: by("runs"),
      topWickets: by("wickets"),
      topSixes: by("sixes"),
      topFours: by("fours"),
      topPom: by("pom"),
      topCatches: by("catches"),
    },
    records: {
      highestTeamScore: highestTeam,
      lowestTeamScore: lowestTeam,
      highestIndividualScore: highestIndividual,
      lowestIndividualScore: lowestIndividual,
      bestBowling,
      mostSixesInnings,
      mostFoursInnings,
    },
    timeline,
  });
});

