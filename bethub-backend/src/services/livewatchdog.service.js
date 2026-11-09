import Match from "../models/Match.model.js";
import logger from "../config/logger.js";
import { MATCH_POPULATE } from "./serializers.js";
import { broadcastMatch, broadcastStream } from "../realtime/broadcast.js";
import { emitAll } from "../realtime/emit.js";
import { deleteLiveKitRoom } from "./livekit.service.js";
import { getLimits } from "./platformsettings.service.js";
import { logAudit } from "./audit.service.js";

const SYSTEM_ACTOR = {
  user: { _id: null, name: "Live watchdog", email: "", role: "system" },
  ip: "system",
};

let running = false;

/**
 * Auto-ends any live stream that has exceeded the admin-configured
 * `maxLiveHours` window. Also deletes the matching LiveKit room so the host
 * is disconnected immediately, and writes a system audit entry.
 */
export const enforceLiveWindows = async ({ req = SYSTEM_ACTOR } = {}) => {
  if (running) return { checked: 0, ended: [], skipped: "already-running" };
  running = true;
  try {
    const limits = await getLimits({ fresh: true });
    const hours = Number(limits.maxLiveHours) || 4;
    const cutoff = new Date(Date.now() - hours * 3_600_000);

    const overlong = await Match.find({
      "stream.isLive": true,
      "stream.startedAt": { $ne: null, $lt: cutoff },
    }).populate(MATCH_POPULATE);

    const ended = [];
    for (const match of overlong) {
      try {
        const wasLiveKit = match.stream.mode === "livekit" || Boolean(match.stream.livekitRoom);
        const wasRecording = Boolean(match.stream.recording);
        match.stream.isLive = false;
        match.stream.endedAt = new Date();
        match.stream.viewers = 0;
        match.stream.livekitRoom = "";
        if (wasRecording) {
          match.stream.recording = false;
          match.stream.recordingStartedAt = undefined;
        }
        await match.save();
        if (wasLiveKit) await deleteLiveKitRoom(match._id);

        const populated = await Match.findById(match._id).populate(MATCH_POPULATE);
        if (populated) {
          broadcastStream(populated);
          broadcastMatch(populated, { event: "stream-limit-reached" });
        }
        emitAll("stream:ended", {
          matchId: match._id,
          slug: match.stream.slug,
          reason: "live-window-expired",
          maxLiveHours: hours,
        });

        const label = `${populated?.teamA?.shortName || "TBC"} vs ${populated?.teamB?.shortName || "TBC"}`;
        await logAudit({
          req,
          category: "stream",
          action: "stream.auto-end",
          summary: `Auto-ended ${label} after the ${hours}h live limit`,
          targetType: "match",
          targetId: match._id,
          meta: {
            mode: match.stream.mode,
            startedAt: match.stream.startedAt,
            maxLiveHours: hours,
            recordingCancelled: wasRecording,
            livekitRoomDeleted: wasLiveKit,
          },
        });

        ended.push({ id: String(match._id), label, mode: match.stream.mode });
        logger.warn(`Live watchdog ended ${label} · exceeded ${hours}h limit`);
      } catch (error) {
        logger.warn("Live watchdog could not end a stream:", error.message);
      }
    }

    return { checked: overlong.length, ended, maxLiveHours: hours };
  } finally {
    running = false;
  }
};

/**
 * Runs a sweep on boot (after a short grace period) and then every minute.
 * Returns a stop function for graceful shutdown.
 */
export const startLiveWatchdog = ({ intervalMs = 60_000 } = {}) => {
  const sweep = () => {
    enforceLiveWindows().catch((error) => logger.warn("Live watchdog sweep failed:", error.message));
  };
  const bootTimer = setTimeout(sweep, 12_000);
  const timer = setInterval(sweep, intervalMs);
  bootTimer.unref?.();
  timer.unref?.();
  logger.info(`Live watchdog armed · sweeps every ${Math.round(intervalMs / 1000)}s`);
  return () => {
    clearTimeout(bootTimer);
    clearInterval(timer);
  };
};

export default { enforceLiveWindows, startLiveWatchdog };
