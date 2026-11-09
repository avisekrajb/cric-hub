import mongoose from "mongoose";
import Match from "../models/Match.model.js";
import ChatMessage from "../models/ChatMessage.model.js";
import Country from "../models/Country.model.js";
import Team from "../models/Team.model.js";
import Player from "../models/Player.model.js";
import Video from "../models/Video.model.js";
import OpsTask from "../models/OpsTask.model.js";
import AuditLog from "../models/AuditLog.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import env from "../config/env.js";
import { MATCH_POPULATE, matchDetail, matchSummary } from "../services/serializers.js";
import { startMatch as startMatchService, finishMatch as finishMatchService } from "../services/scoring.service.js";
import { broadcastMatch } from "../realtime/broadcast.js";
import { emitAdmin, emitAll, getIO } from "../realtime/emit.js";
import { announce } from "../realtime/broadcast.js";
import { logAudit } from "../services/audit.service.js";
import { DEFAULT_FLAGS, listFlags, updateFlag } from "../services/featureflag.service.js";
import { getLimits, limitsPayload, updateLimits } from "../services/platformsettings.service.js";
import { liveWindow } from "../services/livewindow.service.js";
import { enforceLiveWindows } from "../services/livewatchdog.service.js";
import {
  deleteLiveKitRoom,
  livekitConfigured,
  livekitStatus,
  listLiveKitParticipants,
} from "../services/livekit.service.js";

const ISO = () => new Date().toISOString();
const isValidId = (id) => mongoose.isValidObjectId(id);

const adminSockets = () => {
  const io = getIO();
  const rows = [];
  if (!io) return rows;
  for (const socket of io.sockets.sockets.values()) {
    const user = socket.data.user;
    if (!user || !["admin", "editor"].includes(user.role)) continue;
    rows.push({
      socketId: socket.id,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      page: socket.data.page || "",
      connectedAt: socket.data.connectedAt || null,
    });
  }
  return rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

const populatedMatch = async (id) => {
  if (!isValidId(id)) return null;
  return Match.findById(id).populate(MATCH_POPULATE);
};

const viewerTotal = async () => {
  const rows = await Match.aggregate([
    { $match: { "stream.isLive": true } },
    { $group: { _id: null, viewers: { $sum: "$stream.viewers" } } },
  ]);
  return rows[0]?.viewers || 0;
};

const countSnapshot = async () => {
  const [
    matches,
    liveMatches,
    liveStreams,
    recordings,
    upcoming,
    finished,
    countries,
    teams,
    players,
    videos,
    openTasks,
    urgentTasks,
    chatMessages,
    viewers,
    livekitRooms,
  ] = await Promise.all([
    Match.countDocuments(),
    Match.countDocuments({ status: { $in: ["live", "innings-break"] } }),
    Match.countDocuments({ "stream.isLive": true }),
    Match.countDocuments({ "stream.recording": true }),
    Match.countDocuments({ status: "upcoming" }),
    Match.countDocuments({ status: "finished" }),
    Country.countDocuments(),
    Team.countDocuments(),
    Player.countDocuments(),
    Video.countDocuments(),
    OpsTask.countDocuments({ status: { $ne: "done" } }),
    OpsTask.countDocuments({ status: { $ne: "done" }, priority: "urgent" }),
    ChatMessage.countDocuments({ isHidden: false }),
    viewerTotal(),
    Match.countDocuments({ "stream.isLive": true, "stream.mode": "livekit" }),
  ]);

  return {
    matches,
    liveMatches,
    liveStreams,
    recordings,
    upcoming,
    finished,
    countries,
    teams,
    players,
    videos,
    openTasks,
    urgentTasks,
    chatMessages,
    viewers,
    livekitRooms,
    onlineAdmins: adminSockets().length,
  };
};

const buildAlerts = (counts, flags, limits) => {
  const alerts = [];
  if (flags.maintenance_mode) {
    alerts.push({
      id: "maintenance",
      level: "warning",
      title: "Maintenance mode is on",
      text: "Fan chat is paused. Turn it off in feature flags when the ground is ready.",
    });
  }
  if (counts.liveMatches >= limits.maxLiveMatches) {
    alerts.push({
      id: "live-limit",
      level: "critical",
      title: "Live match limit reached",
      text: `${counts.liveMatches} of ${limits.maxLiveMatches} live slots are in use.`,
    });
  }
  if (counts.recordings >= limits.maxRecordings) {
    alerts.push({
      id: "recording-limit",
      level: "warning",
      title: "Recording slots are full",
      text: `${counts.recordings} of ${limits.maxRecordings} concurrent recordings are running.`,
    });
  }
  if (counts.viewers >= 500) {
    alerts.push({
      id: "viewer-surge",
      level: "info",
      title: "Viewer surge",
      text: `${counts.viewers.toLocaleString()} fans are watching across every ground.`,
    });
  }
  if (flags.livekit_enabled && !livekitConfigured) {
    alerts.push({
      id: "livekit-missing",
      level: "warning",
      title: "LiveKit keys are missing",
      text: "Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to enable LiveKit broadcasts.",
    });
  }
  if (counts.urgentTasks) {
    alerts.push({
      id: "urgent-tasks",
      level: "warning",
      title: `${counts.urgentTasks} urgent ops task${counts.urgentTasks === 1 ? "" : "s"}`,
      text: "Open the task board and clear the urgent column.",
    });
  }
  if (mongoose.connection.readyState !== 1) {
    alerts.push({
      id: "db-offline",
      level: "critical",
      title: "Database not connected",
      text: "Realtime writes will fail until MongoDB reconnects.",
    });
  }
  return alerts;
};

const healthSnapshot = async () => {
  const memory = process.memoryUsage();
  const io = getIO();
  return {
    uptime: Math.round(process.uptime()),
    node: process.version,
    db: {
      state: mongoose.connection.readyState,
      label: ["disconnected", "connected", "connecting", "disconnecting"][mongoose.connection.readyState] || "unknown",
      name: mongoose.connection.name || env.dbName,
    },
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
    },
    sockets: io?.sockets?.sockets?.size || 0,
    cloudinary: Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret),
    livekit: livekitStatus(),
    limits: await getLimits(),
    at: ISO(),
  };
};

export const overview = asyncHandler(async (_req, res) => {
  const [counts, live, upcoming, recent, tasks, audit, flags, chat, livekitRooms, limits] = await Promise.all([
    countSnapshot(),
    Match.find({ status: { $in: ["live", "innings-break"] } })
      .sort({ startTime: -1 })
      .limit(10)
      .populate(MATCH_POPULATE),
    Match.find({ status: "upcoming" })
      .sort({ startTime: 1 })
      .limit(6)
      .populate(MATCH_POPULATE),
    Match.find({ status: "finished" })
      .sort({ startTime: -1 })
      .limit(5)
      .populate(MATCH_POPULATE),
    OpsTask.find()
      .sort({ status: 1, priority: -1, dueAt: 1, createdAt: -1 })
      .limit(60)
      .populate({ path: "match", select: "teamA teamB series matchNumber", populate: [{ path: "teamA", select: "name shortName" }, { path: "teamB", select: "name shortName" }] }),
    AuditLog.find().sort({ at: -1 }).limit(25),
    listFlags(),
    ChatMessage.find({ isHidden: false })
      .sort({ createdAt: -1 })
      .limit(14)
      .populate({ path: "match", select: "teamA teamB series matchNumber", populate: [{ path: "teamA", select: "name shortName" }, { path: "teamB", select: "name shortName" }] }),
    Match.find({ "stream.isLive": true, "stream.mode": "livekit" })
      .select("teamA teamB stream series matchNumber")
      .populate([{ path: "teamA", select: "name shortName" }, { path: "teamB", select: "name shortName" }])
      .limit(10),
    getLimits(),
  ]);

  const flagMap = flags.reduce((acc, row) => {
    acc[row.key] = Boolean(row.enabled);
    return acc;
  }, {});

  const rooms = livekitConfigured
    ? await Promise.all(
        livekitRooms.map(async (match) => {
          const participants = await listLiveKitParticipants(match._id);
          return {
            matchId: match._id,
            label: `${match.teamA?.shortName || "TBC"} vs ${match.teamB?.shortName || "TBC"}`,
            room: match.stream?.livekitRoom || "",
            participants: participants.participants,
            ok: participants.ok,
            reason: participants.reason || "",
          };
        })
      )
    : [];

  res.json({
    success: true,
    generatedAt: ISO(),
    counts,
    live: live.map((match) => ({
      ...matchSummary(match),
      liveWindow: match.stream?.isLive ? liveWindow(match.stream, limits) : null,
    })),
    upcoming: upcoming.map(matchSummary),
    recent: recent.map(matchSummary),
    tasks,
    audit,
    flags,
    chat,
    admins: adminSockets(),
    alerts: buildAlerts(counts, flagMap, limits),
    health: await healthSnapshot(),
    livekit: {
      ...livekitStatus(),
      rooms,
    },
    limits,
  });
});

export const pulse = asyncHandler(async (_req, res) => {
  const [liveMatches, liveStreams, recordings, viewers] = await Promise.all([
    Match.countDocuments({ status: { $in: ["live", "innings-break"] } }),
    Match.countDocuments({ "stream.isLive": true }),
    Match.countDocuments({ "stream.recording": true }),
    viewerTotal(),
  ]);
  res.json({
    success: true,
    liveMatches,
    liveStreams,
    recordings,
    viewers,
    onlineAdmins: adminSockets().length,
    at: ISO(),
  });
});

/* ── tasks ──────────────────────────────────────────────────── */
export const listTasks = asyncHandler(async (_req, res) => {
  const tasks = await OpsTask.find()
    .sort({ status: 1, priority: -1, dueAt: 1, createdAt: -1 })
    .limit(100)
    .populate({ path: "match", select: "teamA teamB series matchNumber", populate: [{ path: "teamA", select: "name shortName" }, { path: "teamB", select: "name shortName" }] });
  res.json({ success: true, tasks });
});

export const createTask = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim();
  if (!title) throw ApiError.badRequest("Give the task a title");
  const task = await OpsTask.create({
    title: title.slice(0, 140),
    description: String(body.description || "").slice(0, 1000),
    status: ["todo", "doing", "done"].includes(body.status) ? body.status : "todo",
    priority: ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : "normal",
    assignedTo: String(body.assignedTo || "").slice(0, 80),
    match: isValidId(body.matchId) ? body.matchId : undefined,
    dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
    completedAt: body.status === "done" ? new Date() : undefined,
    createdBy: req.user?._id,
    createdByName: req.user?.name || "Admin",
  });
  const populated = await OpsTask.findById(task._id).populate({
    path: "match",
    select: "teamA teamB series matchNumber",
    populate: [{ path: "teamA", select: "name shortName" }, { path: "teamB", select: "name shortName" }],
  });
  emitAdmin("ops:task", { type: "created", task: populated });
  await logAudit({
    req,
    category: "task",
    action: "task.create",
    summary: `Created ops task “${title}”`,
    targetType: "task",
    targetId: task._id,
    meta: { priority: task.priority },
  });
  res.status(201).json({ success: true, task: populated });
});

export const updateTask = asyncHandler(async (req, res) => {
  const task = await OpsTask.findById(req.params.id);
  if (!task) throw ApiError.notFound("Task not found");
  const body = req.body || {};
  if (body.title !== undefined) task.title = String(body.title).trim().slice(0, 140) || task.title;
  if (body.description !== undefined) task.description = String(body.description).slice(0, 1000);
  if (body.assignedTo !== undefined) task.assignedTo = String(body.assignedTo).slice(0, 80);
  if (["low", "normal", "high", "urgent"].includes(body.priority)) task.priority = body.priority;
  if (["todo", "doing", "done"].includes(body.status)) {
    task.status = body.status;
    task.completedAt = body.status === "done" ? task.completedAt || new Date() : undefined;
  }
  if (body.dueAt !== undefined) task.dueAt = body.dueAt ? new Date(body.dueAt) : undefined;
  if (body.matchId !== undefined) task.match = isValidId(body.matchId) ? body.matchId : undefined;
  await task.save();

  const populated = await OpsTask.findById(task._id).populate({
    path: "match",
    select: "teamA teamB series matchNumber",
    populate: [{ path: "teamA", select: "name shortName" }, { path: "teamB", select: "name shortName" }],
  });
  emitAdmin("ops:task", { type: "updated", task: populated });
  await logAudit({
    req,
    category: "task",
    action: `task.${task.status}`,
    summary: `Updated ops task “${task.title}” · ${task.status}`,
    targetType: "task",
    targetId: task._id,
    meta: { priority: task.priority },
  });
  res.json({ success: true, task: populated });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const task = await OpsTask.findByIdAndDelete(req.params.id);
  if (!task) throw ApiError.notFound("Task not found");
  emitAdmin("ops:task", { type: "deleted", task: { _id: task._id } });
  await logAudit({
    req,
    category: "task",
    action: "task.delete",
    summary: `Deleted ops task “${task.title}”`,
    targetType: "task",
    targetId: task._id,
  });
  res.json({ success: true, id: task._id });
});

/* ── match controls ─────────────────────────────────────────── */
export const matchAction = asyncHandler(async (req, res) => {
  const match = await populatedMatch(req.params.id);
  if (!match) throw ApiError.notFound("Match not found");
  const action = String(req.body?.action || "").trim();
  const label = `${match.teamA?.shortName || "TBC"} vs ${match.teamB?.shortName || "TBC"}`;

  if (action === "start") {
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
  } else if (action === "finish") {
    finishMatchService(match, { manualText: req.body?.resultText || "" });
  } else if (action === "feature" || action === "unfeature") {
    match.isFeatured = action === "feature";
  } else if (action === "end-stream") {
    if (!match.stream?.isLive) throw ApiError.badRequest("This match is not streaming");
    if (match.stream.recording) throw ApiError.badRequest("Stop the recording before ending the stream");
    const wasLiveKit = match.stream.mode === "livekit" || Boolean(match.stream.livekitRoom);
    match.stream.isLive = false;
    match.stream.endedAt = new Date();
    match.stream.viewers = 0;
    match.stream.livekitRoom = "";
    if (wasLiveKit) await deleteLiveKitRoom(match._id);
  } else {
    throw ApiError.badRequest("Unknown match action");
  }

  await match.save();
  const refreshed = await populatedMatch(match._id);
  broadcastMatch(refreshed, { event: `ops-${action}` });
  if (action === "start") {
    announce({
      type: "match-start",
      title: "Cricket is live",
      body: `${label} is under way`,
      matchId: match._id,
      icon: "live",
    });
  }
  await logAudit({
    req,
    category: "match",
    action: `match.${action}`,
    summary: `${label} · ${action}`,
    targetType: "match",
    targetId: match._id,
    meta: { status: match.status, featured: match.isFeatured },
  });
  res.json({ success: true, match: matchDetail(refreshed) });
});

export const bulkMatchAction = asyncHandler(async (req, res) => {
  const action = String(req.body?.action || "").trim();
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(isValidId).slice(0, 50) : [];
  if (!ids.length) throw ApiError.badRequest("Select at least one match");
  if (!["feature", "unfeature", "finish", "end-stream"].includes(action)) {
    throw ApiError.badRequest("Bulk action must be feature, unfeature, finish or end-stream");
  }

  const results = [];
  for (const id of ids) {
    try {
      const match = await populatedMatch(id);
      if (!match) throw new Error("Match not found");
      if (action === "feature" || action === "unfeature") {
        match.isFeatured = action === "feature";
      } else if (action === "finish") {
        finishMatchService(match);
      } else if (action === "end-stream") {
        if (!match.stream?.isLive) throw new Error("Not streaming");
        if (match.stream.recording) throw new Error("Recording in progress");
        const wasLiveKit = match.stream.mode === "livekit" || Boolean(match.stream.livekitRoom);
        match.stream.isLive = false;
        match.stream.endedAt = new Date();
        match.stream.viewers = 0;
        match.stream.livekitRoom = "";
        if (wasLiveKit) await deleteLiveKitRoom(match._id);
      }
      await match.save();
      const refreshed = await populatedMatch(match._id);
      broadcastMatch(refreshed, { event: `ops-bulk-${action}` });
      results.push({ id, ok: true });
    } catch (error) {
      results.push({ id, ok: false, message: error.message });
    }
  }

  const done = results.filter((row) => row.ok).length;
  await logAudit({
    req,
    category: "match",
    action: `match.bulk-${action}`,
    summary: `Bulk ${action} · ${done}/${ids.length} matches`,
    targetType: "match",
    meta: { action, requested: ids.length, done, results },
  });
  res.json({ success: true, action, done, results });
});

/* ── chat moderation ───────────────────────────────────────── */
export const listChat = asyncHandler(async (req, res) => {
  const limit = Math.min(60, Number(req.query.limit) || 25);
  const messages = await ChatMessage.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: "match", select: "teamA teamB series matchNumber", populate: [{ path: "teamA", select: "name shortName" }, { path: "teamB", select: "name shortName" }] });
  res.json({ success: true, messages });
});

export const moderateChat = asyncHandler(async (req, res) => {
  const message = await ChatMessage.findById(req.params.id);
  if (!message) throw ApiError.notFound("Message not found");
  const body = req.body || {};
  if (body.isHidden !== undefined) message.isHidden = Boolean(body.isHidden);
  if (body.isPinned !== undefined) message.isPinned = Boolean(body.isPinned);
  await message.save();
  const payload = message.toJSON();
  emitAll("chat:update", payload);
  if (message.isHidden) emitAll("chat:delete", { messageId: String(message._id), matchId: String(message.match) });
  emitAdmin("ops:chat", { type: "moderated", message: payload });
  await logAudit({
    req,
    category: "chat",
    action: message.isHidden ? "chat.hide" : "chat.update",
    summary: `${message.isHidden ? "Hid" : "Updated"} a chat message from ${message.user}`,
    targetType: "chat",
    targetId: message._id,
    meta: { matchId: String(message.match), pinned: message.isPinned },
  });
  res.json({ success: true, message: payload });
});

export const deleteChat = asyncHandler(async (req, res) => {
  const message = await ChatMessage.findByIdAndDelete(req.params.id);
  if (!message) throw ApiError.notFound("Message not found");
  emitAll("chat:delete", { messageId: String(message._id), matchId: String(message.match), permanent: true });
  await logAudit({
    req,
    category: "chat",
    action: "chat.delete",
    summary: `Deleted a chat message from ${message.user}`,
    targetType: "chat",
    targetId: message._id,
    meta: { matchId: String(message.match) },
  });
  res.json({ success: true, id: message._id });
});

/* ── health, flags, announcements ───────────────────────────── */
export const health = asyncHandler(async (_req, res) => {
  res.json({ success: true, health: await healthSnapshot() });
});

export const flags = asyncHandler(async (_req, res) => {
  res.json({ success: true, flags: await listFlags(), defaults: DEFAULT_FLAGS });
});

export const setFlag = asyncHandler(async (req, res) => {
  const exists = await listFlags();
  if (!exists.some((row) => row.key === req.params.key)) throw ApiError.notFound("Feature flag not found");
  const payload = await updateFlag(req.params.key, req.body?.enabled, req.user);
  await logAudit({
    req,
    category: "flag",
    action: "flag.update",
    summary: `${payload.label} ${payload.enabled ? "enabled" : "disabled"}`,
    targetType: "flag",
    targetId: payload.key,
    meta: { enabled: payload.enabled },
  });
  res.json({ success: true, flag: payload });
});

export const sendAnnouncement = asyncHandler(async (req, res) => {
  const title = String(req.body?.title || "").trim().slice(0, 120);
  const body = String(req.body?.body || "").trim().slice(0, 400);
  if (!title || !body) throw ApiError.badRequest("Write a title and a message");
  const notification = announce({
    type: req.body?.type || "announcement",
    title,
    body,
    matchId: isValidId(req.body?.matchId) ? req.body.matchId : undefined,
    icon: "megaphone",
    from: req.user?.name || "Bethub",
  });
  emitAdmin("ops:announce", notification);
  await logAudit({
    req,
    category: "announcement",
    action: "announcement.send",
    summary: `Announced “${title}”`,
    targetType: "announcement",
    targetId: notification.id,
    meta: { body },
  });
  res.status(201).json({ success: true, notification });
});

/* ── LiveKit ────────────────────────────────────────────────── */
export const livekitOverview = asyncHandler(async (_req, res) => {
  const matches = await Match.find({ "stream.isLive": true, "stream.mode": "livekit" })
    .select("teamA teamB stream series matchNumber")
    .populate([{ path: "teamA", select: "name shortName" }, { path: "teamB", select: "name shortName" }])
    .limit(10);
  const rooms = await Promise.all(
    matches.map(async (match) => {
      const participants = await listLiveKitParticipants(match._id);
      return {
        matchId: match._id,
        label: `${match.teamA?.shortName || "TBC"} vs ${match.teamB?.shortName || "TBC"}`,
        series: match.series,
        room: match.stream?.livekitRoom || "",
        participants: participants.participants,
        ok: participants.ok,
        reason: participants.reason || "",
      };
    })
  );
  res.json({ success: true, ...livekitStatus(), rooms });
});

/* ── platform limits (admin-editable, no restart) ───────────── */
export const getPlatformLimits = asyncHandler(async (_req, res) => {
  res.json({ success: true, ...(await limitsPayload()) });
});

export const setPlatformLimits = asyncHandler(async (req, res) => {
  const payload = await updateLimits(req.body || {}, req.user);
  await logAudit({
    req,
    category: "settings",
    action: "limits.update",
    summary: `Platform limits updated · live ${payload.limits.maxLiveHours}h · video ${payload.limits.maxVideoMb}MB · image ${payload.limits.maxImageMb}MB`,
    targetType: "settings",
    targetId: "platform",
    meta: payload.limits,
  });
  res.json({ success: true, ...payload, message: "Platform limits updated — live immediately" });
});

export const enforceLiveLimits = asyncHandler(async (req, res) => {
  const result = await enforceLiveWindows({ req });
  await logAudit({
    req,
    category: "stream",
    action: "stream.enforce-limits",
    summary: `Manual live-limit sweep ended ${result.ended.length} stream${result.ended.length === 1 ? "" : "s"}`,
    targetType: "stream",
    meta: { maxLiveHours: result.maxLiveHours, ended: result.ended },
  });
  res.json({ success: true, ...result });
});

/* ── CSV exports ────────────────────────────────────────────── */
const csvEscape = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const toCsv = (headers, rows) => [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");

export const exportCsv = asyncHandler(async (req, res) => {
  const type = String(req.query.type || "matches");
  let headers = [];
  let rows = [];

  if (type === "matches") {
    const matches = await Match.find().sort({ startTime: -1 }).limit(2000).populate("teamA teamB");
    headers = ["id", "status", "format", "series", "matchNumber", "teamA", "teamB", "venue", "city", "startTime", "views", "streamViews", "isLive", "mode"];
    rows = matches.map((match) => [
      match._id,
      match.status,
      match.format,
      match.series,
      match.matchNumber,
      match.teamA?.name || "",
      match.teamB?.name || "",
      match.venue,
      match.city,
      match.startTime?.toISOString?.() || "",
      match.views || 0,
      match.stream?.totalViews || 0,
      match.stream?.isLive ? "yes" : "no",
      match.stream?.mode || "",
    ]);
  } else if (type === "players") {
    const players = await Player.find().sort({ name: 1 }).populate("country");
    headers = ["id", "name", "country", "role", "battingStyle", "bowlingStyle", "jerseyNumber", "isCaptain", "isWicketkeeper", "isActive"];
    rows = players.map((player) => [
      player._id,
      player.name,
      player.country?.name || "",
      player.role,
      player.battingStyle,
      player.bowlingStyle,
      player.jerseyNumber ?? "",
      player.isCaptain ? "yes" : "no",
      player.isWicketkeeper ? "yes" : "no",
      player.isActive ? "yes" : "no",
    ]);
  } else if (type === "teams") {
    const teams = await Team.find().sort({ name: 1 }).populate("country");
    headers = ["id", "name", "shortName", "country", "players", "captain", "coach", "homeGround", "isActive"];
    rows = teams.map((team) => [
      team._id,
      team.name,
      team.shortName,
      team.country?.name || "",
      (team.players || []).length,
      String(team.captain || ""),
      team.coach,
      team.homeGround,
      team.isActive ? "yes" : "no",
    ]);
  } else if (type === "countries") {
    const countries = await Country.find().sort({ name: 1 }).populate("playerCount");
    headers = ["id", "name", "code", "isActive", "players"];
    rows = countries.map((country) => [
      country._id,
      country.name,
      country.code,
      country.isActive ? "yes" : "no",
      country.playerCount || 0,
    ]);
  } else if (type === "tasks") {
    const tasks = await OpsTask.find().sort({ createdAt: -1 });
    headers = ["id", "title", "status", "priority", "assignedTo", "dueAt", "completedAt", "createdAt"];
    rows = tasks.map((task) => [
      task._id,
      task.title,
      task.status,
      task.priority,
      task.assignedTo,
      task.dueAt?.toISOString?.() || "",
      task.completedAt?.toISOString?.() || "",
      task.createdAt?.toISOString?.() || "",
    ]);
  } else if (type === "audit") {
    const logs = await AuditLog.find().sort({ at: -1 }).limit(5000);
    headers = ["at", "actor", "category", "action", "summary", "targetType", "targetId"];
    rows = logs.map((log) => [
      log.at?.toISOString?.() || "",
      log.actor?.name || "System",
      log.category,
      log.action,
      log.summary,
      log.targetType,
      log.targetId,
    ]);
  } else {
    throw ApiError.badRequest("Unknown export type");
  }

  const csv = toCsv(headers, rows);
  const stamp = new Date().toISOString().slice(0, 10);
  await logAudit({
    req,
    category: "export",
    action: `export.${type}`,
    summary: `Exported ${rows.length} ${type} row${rows.length === 1 ? "" : "s"} as CSV`,
    targetType: "export",
    targetId: type,
    meta: { rows: rows.length },
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="bethub-${type}-${stamp}.csv"`);
  res.send(csv);
});

/* ── audit feed ─────────────────────────────────────────────── */
export const auditFeed = asyncHandler(async (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 60);
  const filter = {};
  if (req.query.category && req.query.category !== "all") filter.category = req.query.category;
  if (req.query.q) {
    const q = String(req.query.q).trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { summary: { $regex: q, $options: "i" } },
      { action: { $regex: q, $options: "i" } },
      { "actor.name": { $regex: q, $options: "i" } },
    ];
  }
  const logs = await AuditLog.find(filter).sort({ at: -1 }).limit(limit);
  res.json({ success: true, logs });
});
