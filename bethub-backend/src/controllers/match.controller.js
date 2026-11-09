import mongoose from "mongoose";
import Match from "../models/Match.model.js";
import Team from "../models/Team.model.js";
import Ball from "../models/Ball.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import env from "../config/env.js";
import { FORMATS } from "../utils/constants.js";
import { MATCH_POPULATE, matchDetail, matchSummary } from "../services/serializers.js";
import { startMatch as startMatchService, finishMatch as finishMatchService } from "../services/scoring.service.js";
import { broadcastMatch, announce } from "../realtime/broadcast.js";
import { logAudit } from "../services/audit.service.js";
import { getLimits } from "../services/platformsettings.service.js";

const isValidId = (id) => mongoose.isValidObjectId(id);

export const findPopulatedMatch = async (idOrSlug) => {
  const query = isValidId(idOrSlug)
    ? { $or: [{ _id: idOrSlug }, { "stream.slug": idOrSlug }] }
    : { "stream.slug": String(idOrSlug) };
  return Match.findOne(query).populate(MATCH_POPULATE);
};

const lineupsFromTeam = (team, provided = []) => {
  const available = new Set((team.players || []).map((p) => String(p._id || p)));
  let rows = Array.isArray(provided) ? provided : [];
  if (!rows.length) rows = (team.players || []).slice(0, 11).map((p) => String(p._id || p));
  rows = rows.slice(0, 11);
  if (rows.length < 2) throw ApiError.badRequest(`${team.shortName || team.name} needs at least 2 players in the line-up`);
  const seen = new Set();
  const mapped = rows.map((row, index) => {
    const id = String(typeof row === "string" ? row : row?.player?._id || row?.player || "");
    if (!id || seen.has(id)) throw ApiError.badRequest(`Duplicate or invalid player in ${team.shortName} line-up`);
    if (!available.has(id)) throw ApiError.badRequest(`A selected player does not belong to ${team.name}`);
    seen.add(id);
    const flags = typeof row === "object" ? row : {};
    return {
      player: id,
      order: Number(flags.order ?? index),
      isCaptain: Boolean(flags.isCaptain) || String(team.captain) === id,
      isKeeper: Boolean(flags.isKeeper) || String(team.wicketkeeper) === id,
    };
  });
  return mapped.sort((a, b) => a.order - b.order).map((row, index) => ({ ...row, order: index }));
};

export const listMatches = asyncHandler(async (req, res) => {
  const { status, series, team, format, featured, limit = 60, scope } = req.query;
  const filter = {};
  if (status === "live") filter.status = { $in: ["live", "innings-break"] };
  else if (status && status !== "all") filter.status = status;
  if (series) filter.series = series;
  if (format) filter.format = format;
  if (featured === "true") filter.isFeatured = true;
  if (team) filter.$or = [{ teamA: team }, { teamB: team }];
  if (scope === "public") filter.status = { $ne: "abandoned" };

  const matches = await Match.find(filter)
    .sort({ startTime: -1, createdAt: -1 })
    .limit(Math.min(150, Number(limit) || 60))
    .populate([
      { path: "teamA", populate: { path: "country" } },
      { path: "teamB", populate: { path: "country" } },
      { path: "innings.battingTeam" },
      { path: "innings.bowlingTeam" },
      { path: "innings.striker", populate: { path: "country" } },
      { path: "innings.nonStriker", populate: { path: "country" } },
      { path: "innings.bowler", populate: { path: "country" } },
    ]);

  const rank = (match) => {
    if (["live", "innings-break"].includes(match.status)) return 0;
    if (match.status === "upcoming") return 1;
    if (match.status === "finished") return 2;
    return 3;
  };
  const timeOf = (match) => new Date(match.startTime || match.createdAt || 0).getTime();
  matches.sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    const ra = rank(a);
    if (ra === 1) return timeOf(a) - timeOf(b);
    return timeOf(b) - timeOf(a);
  });

  res.json({ success: true, matches: matches.map(matchSummary) });
});

/**
 * One-shot view counter. The client calls this once per browser session so
 * polling a live page never inflates the numbers.
 */
export const registerView = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  match.views = (match.views || 0) + 1;
  if (match.stream?.isLive || ["live", "innings-break"].includes(match.status)) {
    match.stream.totalViews = (match.stream.totalViews || 0) + 1;
  }
  await match.save({ validateBeforeSave: false });
  res.json({
    success: true,
    views: match.views,
    streamViews: match.stream?.totalViews || 0,
  });
});

export const getMatch = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  const chat = [];
  res.json({ success: true, match: matchDetail(match), chat, limits: await getLimits() });
});

export const getLiveBySlug = asyncHandler(async (req, res) => {
  const match = await Match.findOne({ "stream.slug": req.params.slug }).populate(MATCH_POPULATE);
  if (!match) throw ApiError.notFound("Live stream not found or the link has expired");
  match.stream.totalViews = (match.stream.totalViews || 0) + 1;
  await match.save({ validateBeforeSave: false });
  res.json({ success: true, match: matchDetail(match), turn: env.turn });
});

export const createMatch = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const {
    teamA,
    teamB,
    series = "Bethub Series",
    format = "T20",
    overs,
    venue,
    city,
    startTime,
    lineups = {},
    toss = {},
    officials = {},
    isFeatured = false,
    title,
    matchNumber,
  } = body;

  if (!teamA || !teamB) throw ApiError.badRequest("Choose both teams");
  if (String(teamA) === String(teamB)) throw ApiError.badRequest("A team cannot play against itself");
  if (!FORMATS.includes(format)) throw ApiError.badRequest("Invalid match format");

  const teams = await Team.find({ _id: { $in: [teamA, teamB] } }).populate("players");
  if (teams.length !== 2) throw ApiError.badRequest("One or both teams could not be found");
  const teamAModel = teams.find((t) => String(t._id) === String(teamA));
  const teamBModel = teams.find((t) => String(t._id) === String(teamB));

  const lineupA = lineupsFromTeam(teamAModel, lineups.A || lineups[String(teamA)]);
  const lineupB = lineupsFromTeam(teamBModel, lineups.B || lineups[String(teamB)]);

  const defaultOvers = { T10: 10, T20: 20, ODI: 50, Test: 90, Custom: 20 }[format] || 20;
  const count = await Match.countDocuments({ series });

  const tossWinnerSlot = toss?.winnerSlot === "B" ? "B" : "A";
  const tossWinner = tossWinnerSlot === "A" ? teamA : teamB;
  const tossDecision = toss?.decision === "bowl" ? "bowl" : toss?.decision === "bat" ? "bat" : "";

  const match = await Match.create({
    matchNumber: Number(matchNumber) || count + 1,
    title: title || `${teamAModel.shortName} vs ${teamBModel.shortName}`,
    series,
    format,
    overs: Number(overs) || defaultOvers,
    teamA,
    teamB,
    lineups: { A: lineupA, B: lineupB },
    venue,
    city,
    startTime: startTime ? new Date(startTime) : new Date(),
    status: "upcoming",
    toss: tossWinnerSlot
      ? {
          winner: tossWinner,
          winnerSlot: tossWinnerSlot,
          decision: tossDecision,
          text: tossDecision
            ? `${tossWinnerSlot === "A" ? teamAModel.name : teamBModel.name} won the toss and chose to ${tossDecision}`
            : "",
        }
      : {},
    officials,
    isFeatured: Boolean(isFeatured),
    createdBy: req.user?._id,
  });

  const populated = await findPopulatedMatch(match._id);
  await logAudit({
    req,
    category: "match",
    action: "match.create",
    summary: `Created ${populated.teamA?.shortName || "TBC"} vs ${populated.teamB?.shortName || "TBC"} · ${series}`,
    targetType: "match",
    targetId: match._id,
    meta: { format, series },
  });
  res.status(201).json({ success: true, match: matchDetail(populated) });
});

export const updateMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  const body = req.body || {};

  if (body.status && ["upcoming", "live", "finished", "abandoned"].includes(body.status) && body.status !== match.status) {
    if (body.status === "live" && match.status === "upcoming") {
      throw ApiError.badRequest("Use Start match to begin scoring", { useStart: true });
    }
    match.status = body.status;
  }
  for (const field of ["series", "title", "venue", "city", "format", "isFeatured"]) {
    if (body[field] !== undefined) match[field] = body[field];
  }
  if (body.overs !== undefined) match.overs = Math.max(1, Number(body.overs) || 1);
  if (body.startTime) match.startTime = new Date(body.startTime);
  if (body.officials) match.officials = body.officials;
  if (body.playerOfMatch !== undefined) match.playerOfMatch = body.playerOfMatch || undefined;
  if (body.toss) {
    const slot = body.toss.winnerSlot === "B" ? "B" : "A";
    const winner = slot === "A" ? match.teamA : match.teamB;
    const decision = body.toss.decision === "bowl" ? "bowl" : "bat";
    const winnerTeam = await Team.findById(winner);
    match.toss = {
      winner,
      winnerSlot: slot,
      decision,
      text: `${winnerTeam?.name || "Team"} won the toss and chose to ${decision}`,
    };
  }

  const lineupsLocked = ["live", "innings-break", "finished"].includes(match.status);
  if (body.lineups && !lineupsLocked) {
    const teams = await Team.find({ _id: { $in: [match.teamA, match.teamB] } }).populate("players");
    const a = teams.find((t) => String(t._id) === String(match.teamA));
    const b = teams.find((t) => String(t._id) === String(match.teamB));
    if (body.lineups.A) match.lineups.A = lineupsFromTeam(a, body.lineups.A);
    if (body.lineups.B) match.lineups.B = lineupsFromTeam(b, body.lineups.B);
  } else if (body.lineups && lineupsLocked) {
    throw ApiError.badRequest("Line-ups cannot be changed after the match has started");
  }

  await match.save();
  const populated = await findPopulatedMatch(match._id);
  broadcastMatch(populated);
  res.json({ success: true, match: matchDetail(populated) });
});

export const startMatch = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  if (["live", "innings-break"].includes(match.status)) throw ApiError.conflict("This match is already live");
  if (match.status === "finished") throw ApiError.conflict("This match has already finished");

  const liveCount = await Match.countDocuments({
    _id: { $ne: match._id },
    status: { $in: ["live", "innings-break"] },
  });
  const limits = await getLimits();
  if (liveCount >= limits.maxLiveMatches) {
    throw ApiError.conflict(`Live match limit reached (${limits.maxLiveMatches}). End a live match first.`);
  }

  startMatchService(match, { status: "live" });
  await match.save();
  const populated = await findPopulatedMatch(match._id);
  broadcastMatch(populated);
  announce({
    type: "match-start",
    title: "Cricket is live",
    body: `${populated.teamA.shortName} vs ${populated.teamB.shortName} is under way`,
    matchId: match._id,
    icon: "live",
  });
  await logAudit({
    req,
    category: "match",
    action: "match.start",
    summary: `${populated.teamA?.shortName || "TBC"} vs ${populated.teamB?.shortName || "TBC"} started`,
    targetType: "match",
    targetId: match._id,
  });
  res.json({ success: true, match: matchDetail(populated) });
});

export const finishMatch = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  finishMatchService(match, { manualText: req.body?.resultText || "" });
  await match.save();
  const populated = await findPopulatedMatch(match._id);
  broadcastMatch(populated);
  await logAudit({
    req,
    category: "match",
    action: "match.finish",
    summary: `${populated.teamA?.shortName || "TBC"} vs ${populated.teamB?.shortName || "TBC"} finished`,
    targetType: "match",
    targetId: match._id,
    meta: { result: populated.result?.text || "" },
  });
  res.json({ success: true, match: matchDetail(populated) });
});

export const deleteMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  if (["live", "innings-break"].includes(match.status)) throw ApiError.conflict("End the live match before deleting it");
  await Ball.deleteMany({ match: match._id });
  await match.deleteOne();
  await logAudit({
    req,
    category: "match",
    action: "match.delete",
    summary: `Deleted match ${match._id}`,
    targetType: "match",
    targetId: match._id,
  });
  res.json({ success: true, message: "Match deleted" });
});

export const setFeatured = asyncHandler(async (req, res) => {
  const match = await Match.findByIdAndUpdate(
    req.params.id,
    { isFeatured: Boolean(req.body?.isFeatured) },
    { new: true }
  ).populate(MATCH_POPULATE);
  if (!match) throw ApiError.notFound("Match not found");
  broadcastMatch(match);
  await logAudit({
    req,
    category: "match",
    action: match.isFeatured ? "match.feature" : "match.unfeature",
    summary: `${match.teamA?.shortName || "TBC"} vs ${match.teamB?.shortName || "TBC"} ${match.isFeatured ? "featured" : "unfeatured"}`,
    targetType: "match",
    targetId: match._id,
  });
  res.json({ success: true, match: matchDetail(match) });
});

export const getMatchChat = asyncHandler(async (req, res) => {
  const ChatMessage = (await import("../models/ChatMessage.model.js")).default;
  const messages = await ChatMessage.find({ match: req.params.id, isHidden: false })
    .sort({ createdAt: -1 })
    .limit(80);
  res.json({ success: true, messages: messages.reverse() });
});
