import Match from "../models/Match.model.js";
import Ball from "../models/Ball.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { matchDetail } from "../services/serializers.js";
import {
  applyBall,
  undoLastBall,
  setBowler,
  swapStrike,
  endInnings,
  addManualCommentary,
} from "../services/scoring.service.js";
import { broadcastMatch } from "../realtime/broadcast.js";
import { findPopulatedMatch } from "./match.controller.js";

const reload = async (id) => {
  const match = await findPopulatedMatch(id);
  if (!match) throw ApiError.notFound("Match not found");
  return match;
};

export const addBall = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");

  const result = await applyBall(match, req.body || {}, req.user);
  const populated = await reload(match._id);
  const broadcast = broadcastMatch(populated, {
    event: result.event,
    strikeChanged: result.strikeChanged,
    commentary: result.commentary,
  });

  res.status(201).json({
    success: true,
    match: matchDetail(populated),
    ball: result.ball,
    commentary: result.commentary,
    strikeChanged: result.strikeChanged,
    event: result.event,
    summary: broadcast?.summary,
  });
});

export const undoBall = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  await undoLastBall(match);
  const populated = await reload(match._id);
  broadcastMatch(populated, { event: "undo" });
  res.json({ success: true, match: matchDetail(populated), message: "Last delivery removed" });
});

export const changeBowler = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  if (!req.body?.playerId) throw ApiError.badRequest("Choose a bowler");
  setBowler(match, req.body.playerId);
  await match.save();
  const populated = await reload(match._id);
  broadcastMatch(populated);
  res.json({ success: true, match: matchDetail(populated) });
});

export const changeStrike = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  swapStrike(match);
  await match.save();
  const populated = await reload(match._id);
  broadcastMatch(populated, { strikeChanged: true, manual: true });
  res.json({ success: true, match: matchDetail(populated) });
});

export const finishInnings = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  endInnings(match, { declared: Boolean(req.body?.declared) });
  await match.save();
  const populated = await reload(match._id);
  broadcastMatch(populated, { event: "innings-break" });
  res.json({ success: true, match: matchDetail(populated) });
});

export const addCommentary = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  const text = String(req.body?.text || "").trim();
  if (!text) throw ApiError.badRequest("Commentary text is required");
  const { event } = addManualCommentary(match, { text, innings: Number(req.body?.innings) || match.currentInnings });
  await match.save();
  const ball = await Ball.create({
    match: match._id,
    innings: match.currentInnings,
    over: event.over,
    ball: event.ball,
    commentary: text,
    isLegal: false,
    scoreAfter: {
      runs: match.innings[match.currentInnings].runs,
      wickets: match.innings[match.currentInnings].wickets,
      balls: match.innings[match.currentInnings].balls,
      over: `${Math.floor(match.innings[match.currentInnings].balls / 6)}.${match.innings[match.currentInnings].balls % 6}`,
    },
    createdBy: req.user?._id,
  });
  const populated = await reload(match._id);
  broadcastMatch(populated, { event: "commentary", commentary: text });
  res.status(201).json({ success: true, match: matchDetail(populated), commentary: text, ball });
});

export const listBalls = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  const limit = Math.min(200, Number(req.query.limit) || 60);
  const filter = { match: match._id };
  if (req.query.innings !== undefined) filter.innings = Number(req.query.innings);
  if (req.query.wickets === "true") filter["wicket.isWicket"] = true;
  const balls = await Ball.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("batsman", "name photo")
    .populate("bowler", "name photo");
  res.json({ success: true, balls: balls.reverse() });
});

export const resetMatch = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  if (req.body?.confirm !== true) throw ApiError.badRequest("Send confirm: true to reset this match");
  match.innings = [];
  match.undoStack = [];
  match.currentInnings = 0;
  match.target = null;
  match.result = {};
  match.status = "upcoming";
  match.stream.isLive = false;
  match.stream.endedAt = new Date();
  await Ball.deleteMany({ match: match._id });
  await match.save();
  const populated = await reload(match._id);
  broadcastMatch(populated, { event: "reset" });
  res.json({ success: true, match: matchDetail(populated), message: "Match scorecard reset" });
});

export const scoreboardSnapshot = asyncHandler(async (req, res) => {
  const match = await findPopulatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  res.json({ success: true, match: matchDetail(match) });
});
