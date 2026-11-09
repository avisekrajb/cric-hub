import QRCode from "qrcode";
import Match from "../models/Match.model.js";
import Video from "../models/Video.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import env from "../config/env.js";
import { buildStreamSlug, streamKey } from "../utils/ids.js";
import { MATCH_POPULATE, matchDetail, matchSummary, streamMini } from "../services/serializers.js";
import { uploadVideo, destroyAsset } from "../config/cloudinary.js";
import { broadcastMatch, broadcastStream, announce } from "../realtime/broadcast.js";
import { emitAll } from "../realtime/emit.js";
import {
  createLiveKitToken,
  deleteLiveKitRoom,
  ensureLiveKitRoom,
  livekitConfigured,
  livekitStatus,
} from "../services/livekit.service.js";
import { getFlag, flagSnapshot } from "../services/featureflag.service.js";
import { logAudit } from "../services/audit.service.js";
import { getLimits } from "../services/platformsettings.service.js";
import { liveWindow } from "../services/livewindow.service.js";

const requirement = (match) => {
  if (!match) throw ApiError.notFound("Match not found");
};

const populatedLabel = (match) => `${match?.teamA?.shortName || "TBC"} vs ${match?.teamB?.shortName || "TBC"}`;

const ensurePlayback = (match) => {
  if (!match.stream.slug) match.stream.slug = buildStreamSlug(match);
  if (!match.stream.streamKey) match.stream.streamKey = streamKey();
  match.stream.playbackUrl = `${env.publicUrl.replace(/\/$/, "")}/live/${match.stream.slug}`;
  return match.stream.playbackUrl;
};

export const goLive = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id).populate("teamA teamB");
  requirement(match);
  if (match.status === "finished") throw ApiError.badRequest("This match has finished. Start a new match to go live.");
  const { mode = "camera", hlsUrl = "", embedUrl = "", title = "", thumbnail = "" } = req.body || {};
  if (!["camera", "hls", "embed", "livekit"].includes(mode)) throw ApiError.badRequest("Invalid stream mode");
  if (mode === "hls" && !hlsUrl) throw ApiError.badRequest("Paste an HLS stream URL");
  if (mode === "embed" && !embedUrl) throw ApiError.badRequest("Paste an embed URL");
  if (mode === "livekit") {
    if (!livekitConfigured) {
      throw ApiError.badRequest("LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET on the server.");
    }
    if (!(await getFlag("livekit_enabled", true))) {
      throw ApiError.badRequest("LiveKit video is disabled in feature flags");
    }
  }

  const liveCount = await Match.countDocuments({
    _id: { $ne: match._id },
    "stream.isLive": true,
  });
  const limits = await getLimits();
  if (liveCount >= limits.maxLiveMatches) {
    throw ApiError.conflict(`You can run at most ${limits.maxLiveMatches} live matches at once`);
  }

  let livekitRoom = "";
  if (mode === "livekit") {
    const room = await ensureLiveKitRoom(match._id, title || `${match.teamA?.shortName || "Team A"} vs ${match.teamB?.shortName || "Team B"}`);
    if (!room.ok) throw ApiError.badRequest(room.reason || "Could not create the LiveKit room");
    livekitRoom = room.room;
  }

  const playbackUrl = ensurePlayback(match);
  Object.assign(match.stream, {
    isLive: true,
    mode,
    title: title || `${match.teamA?.shortName || "Team A"} vs ${match.teamB?.shortName || "Team B"}`,
    hlsUrl,
    embedUrl,
    livekitRoom,
    thumbnail,
    startedAt: new Date(),
    endedAt: null,
    lastHeartbeatAt: new Date(),
  });
  await match.save();

  await logAudit({
    req,
    category: "stream",
    action: "stream.go-live",
    summary: `${populatedLabel(match)} went live in ${mode} mode`,
    targetType: "match",
    targetId: match._id,
    meta: { mode, livekitRoom: livekitRoom || undefined },
  });

  const populated = await Match.findById(match._id).populate(MATCH_POPULATE);
  broadcastStream(populated);
  broadcastMatch(populated, { event: "stream-start" });
  announce({
    type: "stream",
    title: "Live video is up",
    body: `${populated.teamA.shortName} vs ${populated.teamB.shortName} is streaming now`,
    matchId: match._id,
    streamSlug: match.stream.slug,
    icon: "live",
  });

  res.json({
    success: true,
    stream: { ...streamMini(match.stream), playbackUrl, streamKey: match.stream.streamKey },
    match: matchDetail(populated),
  });
});

export const endLive = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  requirement(match);
  if (match.stream.recording) throw ApiError.badRequest("Stop the recording before ending the live stream");
  const wasLiveKit = match.stream.mode === "livekit" || Boolean(match.stream.livekitRoom);
  match.stream.isLive = false;
  match.stream.endedAt = new Date();
  match.stream.viewers = 0;
  match.stream.livekitRoom = "";
  await match.save();
  if (wasLiveKit) await deleteLiveKitRoom(match._id);
  const populated = await Match.findById(match._id).populate(MATCH_POPULATE);
  await logAudit({
    req,
    category: "stream",
    action: "stream.end-live",
    summary: `${populatedLabel(populated)} ended the live stream`,
    targetType: "match",
    targetId: match._id,
    meta: { mode: match.stream.mode },
  });
  broadcastStream(populated);
  broadcastMatch(populated, { event: "stream-end" });
  emitAll("stream:ended", { matchId: match._id, slug: match.stream.slug });
  res.json({ success: true, stream: streamMini(match.stream), match: matchDetail(populated) });
});

export const startRecording = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  requirement(match);
  if (!match.stream.isLive) throw ApiError.badRequest("Go live before starting a recording");
  if (match.stream.recording) throw ApiError.conflict("This match is already being recorded");

  const active = await Match.countDocuments({ "stream.recording": true, _id: { $ne: match._id } });
  const limits = await getLimits();
  if (active >= limits.maxRecordings) {
    throw ApiError.conflict(`You can record a maximum of ${limits.maxRecordings} matches at the same time`);
  }

  match.stream.recording = true;
  match.stream.recordingStartedAt = new Date();
  await match.save();
  const populated = await Match.findById(match._id).populate(MATCH_POPULATE);
  broadcastStream(populated);
  res.json({ success: true, stream: streamMini(match.stream), matchId: match._id, limits });
});

export const cancelRecording = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  requirement(match);
  match.stream.recording = false;
  match.stream.recordingStartedAt = undefined;
  await match.save();
  const populated = await Match.findById(match._id).populate(MATCH_POPULATE);
  broadcastStream(populated);
  res.json({ success: true, stream: streamMini(match.stream) });
});

export const finishRecording = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id).populate("teamA teamB");
  requirement(match);
  if (!req.file) throw ApiError.badRequest("No recording file was uploaded");

  const duration = Number(req.body?.duration) || 0;
  const title = String(req.body?.title || "").trim() || `${match.teamA?.shortName} vs ${match.teamB?.shortName} replay`;
  let uploaded;
  try {
    uploaded = await uploadVideo(req.file.path, `bethub/replays/${match._id}`);
    const video = await Video.create({
      title,
      description: `Full replay · ${match.series}`,
      type: "replay",
      match: match._id,
      url: uploaded.url,
      publicId: uploaded.publicId,
      thumbnail: uploaded.thumbnail,
      duration,
      bytes: uploaded.bytes,
      format: uploaded.format,
      createdBy: req.user?._id,
    });

    match.stream.recording = false;
    match.stream.recordingStartedAt = undefined;
    match.stream.recordingUrl = uploaded.url;
    match.stream.recordingPublicId = uploaded.publicId;
    match.stream.recordingBytes = uploaded.bytes;
    match.stream.recordingDuration = duration;
    if (!match.stream.thumbnail) match.stream.thumbnail = uploaded.thumbnail;
    await match.save();

    const populated = await Match.findById(match._id).populate(MATCH_POPULATE);
    broadcastStream(populated);
    announce({
      type: "recording",
      title: "Replay uploaded",
      body: `${title} is ready to watch`,
      matchId: match._id,
      videoId: video._id,
      icon: "video",
    });
    res.status(201).json({ success: true, video, stream: streamMini(match.stream) });
  } catch (error) {
    match.stream.recording = false;
    match.stream.recordingStartedAt = undefined;
    await match.save().catch(() => {});
    throw error;
  }
});

export const streamBySlug = asyncHandler(async (req, res) => {
  const match = await Match.findOne({ "stream.slug": req.params.slug }).populate(MATCH_POPULATE);
  if (!match) throw ApiError.notFound("This live link is not available");
  const limits = await getLimits();
  res.json({
    success: true,
    match: matchDetail(match),
    turn: env.turn,
    playbackUrl: match.stream.playbackUrl,
    livekit: livekitStatus(),
    limits,
    liveWindow: liveWindow(match.stream, limits),
  });
});

/**
 * Viewer tokens are public; host tokens require an admin session.
 */
export const livekitToken = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id).populate("teamA teamB");
  requirement(match);
  if (!livekitConfigured) throw ApiError.badRequest("LiveKit is not configured on this server");
  if (!match.stream.isLive || match.stream.mode !== "livekit") {
    throw ApiError.badRequest("This match is not broadcasting through LiveKit");
  }
  const role = req.body?.role === "host" ? "host" : "viewer";
  if (role === "host" && !["admin", "editor"].includes(req.user?.role)) {
    throw ApiError.forbidden("Only an admin can request a host token");
  }
  if (role === "host" && !(await getFlag("livekit_enabled", true))) {
    throw ApiError.badRequest("LiveKit video is disabled in feature flags");
  }
  const name =
    role === "host"
      ? req.user?.name || "Bethub host"
      : String(req.body?.name || "Cricket fan").trim().slice(0, 32) || "Cricket fan";
  const limits = await getLimits();
  const window = liveWindow(match.stream, limits);
  if (window.remainingSeconds !== null && window.remainingSeconds <= 0) {
    throw ApiError.badRequest(
      `This live stream reached the ${limits.maxLiveHours}-hour limit. End it and go live again to continue.`
    );
  }
  const result = await createLiveKitToken({
    matchId: match._id,
    role,
    name,
    ttlSeconds: window.remainingSeconds ?? undefined,
  });
  res.json({ success: true, ...result, role, liveWindow: window });
});

export const streamQr = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id).select("stream teamA teamB");
  requirement(match);
  const url = match.stream.playbackUrl || `${env.publicUrl.replace(/\/$/, "")}/live/${match.stream.slug}`;
  if (!match.stream.slug) throw ApiError.badRequest("Go live first to generate a link");
  const dataUrl = await QRCode.toDataURL(url, {
    width: 640,
    margin: 1,
    color: { dark: "#07130e", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  res.json({ success: true, url, qr: dataUrl });
});

export const liveStreams = asyncHandler(async (_req, res) => {
  const matches = await Match.find({ "stream.isLive": true })
    .sort({ "stream.startedAt": -1 })
    .populate([
      { path: "teamA", populate: { path: "country" } },
      { path: "teamB", populate: { path: "country" } },
      { path: "innings.battingTeam" },
      { path: "innings.bowlingTeam" },
    ]);
  res.json({
    success: true,
    streams: matches.map((match) => ({
      ...matchSummary(match),
      playbackUrl: match.stream.playbackUrl,
    })),
    livekit: livekitStatus(),
    limits: await getLimits(),
  });
});

export const recordingStatus = asyncHandler(async (_req, res) => {
  const [live, recording] = await Promise.all([
    Match.countDocuments({ "stream.isLive": true }),
    Match.find({ "stream.recording": true }).select("teamA teamB matchNumber series stream.recordingStartedAt"),
  ]);
  const viewers = await Match.aggregate([
    { $match: { "stream.isLive": true } },
    { $group: { _id: null, total: { $sum: "$stream.viewers" } } },
  ]);
  res.json({
    success: true,
    live,
    recording: recording.length,
    recordings: recording,
    viewers: viewers[0]?.total || 0,
    limits: await getLimits(),
  });
});

export const streamHeartbeat = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  requirement(match);
  if (!match.stream.isLive) return res.json({ success: true, live: false });
  match.stream.lastHeartbeatAt = new Date();
  if (req.body?.viewers !== undefined) {
    const viewers = Math.max(0, Math.min(1_000_000, Number(req.body.viewers) || 0));
    match.stream.viewers = viewers;
  }
  await match.save({ validateBeforeSave: false });
  emitAll("stream:viewers", { matchId: match._id, viewers: match.stream.viewers });
  res.json({ success: true, live: true, viewers: match.stream.viewers });
});

export const removeRecording = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  requirement(match);
  if (match.stream.recording) throw ApiError.badRequest("Stop recording first");
  if (match.stream.recordingPublicId) {
    await destroyAsset(match.stream.recordingPublicId, "video");
  }
  match.stream.recordingUrl = "";
  match.stream.recordingPublicId = "";
  match.stream.recordingBytes = 0;
  match.stream.recordingDuration = 0;
  await match.save();
  res.json({ success: true, stream: streamMini(match.stream) });
});

export const publicConfig = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    limits: await getLimits(),
    turn: env.turn,
    livekit: livekitStatus(),
    flags: await flagSnapshot(),
    cloudinary: { cloudName: env.cloudinary.cloudName },
  });
});
