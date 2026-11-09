import { Server } from "socket.io";
import env from "../config/env.js";
import logger from "../config/logger.js";
import { socketAuth } from "../middleware/auth.js";
import Match from "../models/Match.model.js";
import ChatMessage from "../models/ChatMessage.model.js";
import { setIO, rooms, emitAll } from "./emit.js";
import { getFlag } from "../services/featureflag.service.js";

const REACTIONS = new Set(["🔥", "👏", "💯", "🏏", "😮", "🎉", "💚", "🤯", "🙌"]);
const AVATAR_COLORS = ["#00e28a", "#38bdf8", "#f472b6", "#facc15", "#a78bfa", "#fb923c"];
const viewerTimers = new Map();
const allowedOrigins = new Set(
  [env.clientUrl, env.publicUrl, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"].filter(Boolean)
);

const roomSize = (io, room) => io.sockets.adapter.rooms.get(room)?.size || 0;

const scheduleViewerSync = (io, matchId) => {
  if (viewerTimers.has(matchId)) return;
  viewerTimers.set(
    matchId,
    setTimeout(async () => {
      viewerTimers.delete(matchId);
      const viewers = roomSize(io, `stream:${matchId}`);
      emitAll("stream:viewers", { matchId, viewers });
      try {
        await Match.updateOne({ _id: matchId, "stream.isLive": true }, { $set: { "stream.viewers": viewers } });
      } catch {
        /* non fatal */
      }
    }, 1200)
  );
};

const presencePayload = (io) => ({
  online: io.sockets.sockets.size,
  at: new Date().toISOString(),
});

const adminPresence = (io) => {
  const rows = [];
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

const broadcastPresence = (io) => {
  io.emit("presence:update", presencePayload(io));
  io.to(rooms.admin).emit("admin:presence", {
    admins: adminPresence(io),
    online: io.sockets.sockets.size,
    at: new Date().toISOString(),
  });
};

export const initRealtime = (httpServer) => {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin) || env.nodeEnv !== "production") return callback(null, true);
        return callback(new Error("Origin not allowed"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    maxHttpBufferSize: 1e6,
    pingInterval: 20000,
    pingTimeout: 25000,
  });

  setIO(io);
  io.use(socketAuth);

  io.on("connection", (socket) => {
    socket.data.matches = new Set();
    socket.data.streams = new Set();
    socket.data.chatHits = [];
    socket.data.broadcasting = null;
    socket.data.connectedAt = new Date().toISOString();
    socket.data.page = "";
    socket.join(rooms.global);
    if (socket.data.user) socket.join(rooms.admin);

    socket.emit("connected", {
      socketId: socket.id,
      user: socket.data.user,
      serverTime: new Date().toISOString(),
    });
    broadcastPresence(io);

    socket.on("admin:page", ({ path } = {}) => {
      if (!socket.data.user) return;
      socket.data.page = String(path || "").slice(0, 120);
      broadcastPresence(io);
    });

    // ── rooms ────────────────────────────────────────────────
    socket.on("match:join", async ({ matchId } = {}) => {
      if (!matchId) return;
      const id = String(matchId);
      socket.join(rooms.match(id));
      socket.data.matches.add(id);
      socket.to(rooms.match(id)).emit("match:presence", {
        matchId: id,
        watchers: Math.max(1, roomSize(io, rooms.match(id))),
      });
    });

    socket.on("match:leave", ({ matchId } = {}) => {
      if (!matchId) return;
      const id = String(matchId);
      socket.leave(rooms.match(id));
      socket.data.matches.delete(id);
    });

    socket.on("stream:join", ({ matchId } = {}) => {
      if (!matchId) return;
      const id = String(matchId);
      socket.join(`stream:${id}`);
      socket.data.streams.add(id);
      const viewers = roomSize(io, `stream:${id}`);
      emitAll("stream:viewers", { matchId: id, viewers });
      scheduleViewerSync(io, id);
    });

    socket.on("stream:leave", ({ matchId } = {}) => {
      if (!matchId) return;
      const id = String(matchId);
      socket.leave(`stream:${id}`);
      socket.data.streams.delete(id);
      scheduleViewerSync(io, id);
    });

    // ── chat ─────────────────────────────────────────────────
    socket.on("chat:send", async (payload = {}, ack) => {
      try {
        const matchId = String(payload.matchId || "");
        const text = String(payload.body || "").trim().slice(0, 280);
        if (!matchId || !text) return ack?.({ ok: false, message: "Message is empty" });
        if (await getFlag("maintenance_mode", false)) {
          return ack?.({ ok: false, message: "Chat is paused for maintenance. Try again shortly." });
        }
        if (!(await getFlag("chat_enabled", true))) {
          return ack?.({ ok: false, message: "Live chat is currently switched off by the admin." });
        }

        const now = Date.now();
        socket.data.chatHits = socket.data.chatHits.filter((t) => now - t < 15000);
        if (socket.data.chatHits.length >= 6) {
          return ack?.({ ok: false, message: "You're chatting too fast. Take a breath 🏏" });
        }
        socket.data.chatHits.push(now);

        const name = String(socket.data.user?.name || payload.name || "Guest").trim().slice(0, 32) || "Guest";
        const doc = await ChatMessage.create({
          match: matchId,
          user: name,
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          body: text,
          socketId: socket.id,
        });
        io.to(rooms.match(matchId)).emit("chat:message", doc.toJSON());
        ack?.({ ok: true, id: doc._id });
      } catch (error) {
        logger.warn("chat failed", error.message);
        ack?.({ ok: false, message: "Could not send message" });
      }
    });

    socket.on("chat:delete", async ({ messageId } = {}, ack) => {
      if (!socket.data.user) return ack?.({ ok: false, message: "Admin only" });
      try {
        const doc = await ChatMessage.findByIdAndUpdate(messageId, { isHidden: true }, { new: true });
        if (!doc) return ack?.({ ok: false, message: "Message not found" });
        emitAll("chat:delete", { messageId: String(doc._id), matchId: String(doc.match) });
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, message: "Could not delete" });
      }
    });

    // ── reactions ────────────────────────────────────────────
    socket.on("reaction:send", async ({ matchId, emoji } = {}) => {
      if (!matchId || !REACTIONS.has(emoji)) return;
      if (await getFlag("maintenance_mode", false)) return;
      if (!(await getFlag("reactions_enabled", true))) return;
      io.to(rooms.match(matchId)).emit("reaction:new", {
        id: `${socket.id}-${Date.now()}`,
        emoji,
        at: new Date().toISOString(),
      });
    });

    // ── WebRTC camera broadcasting ───────────────────────────
    socket.on("broadcast:start", ({ matchId } = {}, ack) => {
      if (!socket.data.user) return ack?.({ ok: false, message: "Admin only" });
      if (!matchId) return ack?.({ ok: false, message: "Match missing" });
      const id = String(matchId);
      socket.join(rooms.broadcaster(id));
      socket.data.broadcasting = id;
      io.to(`stream:${id}`).emit("broadcast:started", { matchId: id, broadcasterId: socket.id });
      logger.socket(`Camera broadcast started for ${id}`);
      ack?.({ ok: true });
    });

    socket.on("webrtc:viewer-join", ({ matchId } = {}) => {
      if (!matchId) return;
      const id = String(matchId);
      socket.join(`stream:${id}`);
      socket.data.streams.add(id);
      io.to(rooms.broadcaster(id)).emit("webrtc:viewer-join", {
        matchId: id,
        viewerId: socket.id,
      });
      const viewers = roomSize(io, `stream:${id}`);
      emitAll("stream:viewers", { matchId: id, viewers });
      scheduleViewerSync(io, id);
    });

    socket.on("webrtc:offer", ({ to, sdp, matchId } = {}) => {
      if (!socket.data.user || !to || !sdp) return;
      if (socket.data.broadcasting && String(socket.data.broadcasting) !== String(matchId)) return;
      io.to(to).emit("webrtc:offer", { from: socket.id, sdp, matchId });
    });

    socket.on("webrtc:answer", ({ to, sdp } = {}) => {
      if (!to || !sdp) return;
      io.to(to).emit("webrtc:answer", { from: socket.id, sdp });
    });

    socket.on("webrtc:candidate", ({ to, candidate } = {}) => {
      if (!to || !candidate) return;
      io.to(to).emit("webrtc:candidate", { from: socket.id, candidate });
    });

    socket.on("webrtc:viewer-left", ({ matchId, viewerId } = {}) => {
      if (!matchId || !viewerId) return;
      io.to(rooms.broadcaster(matchId)).emit("webrtc:viewer-left", { viewerId });
    });

    socket.on("broadcast:stop", ({ matchId } = {}) => {
      const id = String(matchId || socket.data.broadcasting || "");
      if (!id) return;
      socket.leave(rooms.broadcaster(id));
      socket.data.broadcasting = null;
      io.to(`stream:${id}`).emit("broadcast:ended", { matchId: id });
      logger.socket(`Camera broadcast stopped for ${id}`);
    });

    socket.on("broadcast:reaction", async ({ matchId, emoji } = {}) => {
      if (!matchId || !REACTIONS.has(emoji)) return;
      if (await getFlag("maintenance_mode", false)) return;
      if (!(await getFlag("reactions_enabled", true))) return;
      io.to(rooms.match(matchId)).emit("reaction:new", { id: `${socket.id}-${Date.now()}`, emoji, at: new Date().toISOString() });
    });

    // ── disconnect ───────────────────────────────────────────
    socket.on("disconnecting", () => {
      for (const id of socket.data.streams) {
        io.to(rooms.broadcaster(id)).emit("webrtc:viewer-left", { viewerId: socket.id });
        scheduleViewerSync(io, id);
      }
      if (socket.data.broadcasting) {
        io.to(`stream:${socket.data.broadcasting}`).emit("broadcast:ended", {
          matchId: socket.data.broadcasting,
          reason: "broadcaster-disconnected",
        });
      }
    });

    socket.on("disconnect", () => {
      broadcastPresence(io);
    });
  });

  // Lightweight ops pulse for the admin control room.
  const pulseTimer = setInterval(async () => {
    try {
      if (!io.sockets.adapter.rooms.get(rooms.admin)?.size) return;
      const [liveMatches, liveStreams, recordings, viewerRows] = await Promise.all([
        Match.countDocuments({ status: { $in: ["live", "innings-break"] } }),
        Match.countDocuments({ "stream.isLive": true }),
        Match.countDocuments({ "stream.recording": true }),
        Match.aggregate([
          { $match: { "stream.isLive": true } },
          { $group: { _id: null, viewers: { $sum: "$stream.viewers" } } },
        ]),
      ]);
      io.to(rooms.admin).emit("ops:pulse", {
        liveMatches,
        liveStreams,
        recordings,
        viewers: viewerRows[0]?.viewers || 0,
        onlineAdmins: adminPresence(io).length,
        at: new Date().toISOString(),
      });
    } catch {
      /* non fatal */
    }
  }, 8000);
  httpServer.on("close", () => clearInterval(pulseTimer));

  logger.socket("Realtime socket server ready");
  return io;
};

export default initRealtime;
