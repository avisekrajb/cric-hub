import crypto from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import env from "../config/env.js";
import logger from "../config/logger.js";

const { url, apiKey, apiSecret, tokenTtl } = env.livekit;

export const livekitConfigured = Boolean(url && apiKey && apiSecret);

const DEFAULT_TOKEN_SECONDS = 6 * 60 * 60;

const ttlToSeconds = (value, fallback = DEFAULT_TOKEN_SECONDS) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.floor(value));
  const match = String(value || "").trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/);
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = match[2] || "s";
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] || 1;
  return Math.max(1, Math.floor(amount * multiplier));
};

/** LiveKit's server SDK expects an http(s) host, while browsers connect over ws(s). */
const httpHost = () => {
  if (!url) return "";
  if (/^wss?:\/\//i.test(url)) return url.replace(/^ws/i, "http");
  return url;
};

/** Browsers must connect over ws(s); accept https/http env values too. */
const wsHost = () => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url.replace(/^http/i, "ws");
  return url;
};

let client = null;

const roomClient = () => {
  if (!livekitConfigured) return null;
  if (!client) client = new RoomServiceClient(httpHost(), apiKey, apiSecret);
  return client;
};

export const roomNameForMatch = (matchId) => `bethub-match-${String(matchId)}`;

export const livekitStatus = () => ({
  enabled: livekitConfigured,
  url: wsHost(),
  host: httpHost(),
});

/**
 * Creates (or reuses) a LiveKit room for a match. Safe to call repeatedly.
 */
export const ensureLiveKitRoom = async (matchId, title = "") => {
  if (!livekitConfigured) return { ok: false, reason: "LiveKit is not configured" };
  const name = roomNameForMatch(matchId);
  try {
    await roomClient().createRoom({
      name,
      emptyTimeout: 300,
      maxParticipants: 500,
      metadata: JSON.stringify({ matchId: String(matchId), title }),
    });
    logger.ok(`LiveKit room created · ${name}`);
  } catch (error) {
    // Already exists is the normal path when restarting a broadcast.
    if (!/already exists|already_exists|exists/i.test(error?.message || "")) {
      logger.warn("LiveKit room create failed:", error.message);
      return { ok: false, reason: error.message };
    }
  }
  return { ok: true, room: name, url: wsHost() };
};

export const deleteLiveKitRoom = async (matchId) => {
  if (!livekitConfigured) return { ok: false };
  const name = roomNameForMatch(matchId);
  try {
    await roomClient().deleteRoom(name);
    logger.info(`LiveKit room deleted · ${name}`);
    return { ok: true };
  } catch (error) {
    logger.warn("LiveKit room delete failed:", error.message);
    return { ok: false, reason: error.message };
  }
};

export const listLiveKitParticipants = async (matchId) => {
  if (!livekitConfigured) return { ok: false, participants: [] };
  try {
    const rows = await roomClient().listParticipants(roomNameForMatch(matchId));
    return {
      ok: true,
      participants: (rows || []).map((row) => ({
        identity: row.identity,
        name: row.name,
        state: row.state,
        joinedAt: row.joinedAt ? Number(row.joinedAt) * 1000 : null,
        isPublisher: Boolean(row.permission?.canPublish),
      })),
    };
  } catch (error) {
    return { ok: false, participants: [], reason: error.message };
  }
};

/**
 * Mints a LiveKit access token.
 * Viewers can subscribe only; the host publishes camera + microphone.
 * `ttlSeconds` lets the stream controller cap the token to the remaining
 * admin-configured live window instead of the default 6-hour TTL.
 */
export const createLiveKitToken = async ({ matchId, role = "viewer", identity, name, ttlSeconds }) => {
  if (!livekitConfigured) throw new Error("LiveKit is not configured");
  const host = role === "host";
  const identityValue = identity || `${host ? "host" : "fan"}-${crypto.randomUUID()}`;
  const requested = Number(ttlSeconds);
  const ttl = Number.isFinite(requested) && requested > 0
    ? Math.max(30, Math.floor(requested))
    : ttlToSeconds(tokenTtl, DEFAULT_TOKEN_SECONDS);
  const token = new AccessToken(apiKey, apiSecret, {
    identity: identityValue,
    name: name || (host ? "Bethub host" : "Cricket fan"),
    ttl,
    metadata: JSON.stringify({ matchId: String(matchId), role, maxTtlSeconds: ttl }),
  });
  token.addGrant({
    roomJoin: true,
    room: roomNameForMatch(matchId),
    canPublish: host,
    canSubscribe: true,
    canPublishData: true,
  });
  return {
    token: await token.toJwt(),
    url: wsHost(),
    room: roomNameForMatch(matchId),
    identity: identityValue,
    role,
    ttlSeconds: ttl,
  };
};

export { ttlToSeconds };
