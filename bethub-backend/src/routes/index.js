import { Router } from "express";
import { auth, optionalAuth, requireAdmin } from "../middleware/auth.js";
import { imageUpload, videoUpload } from "../middleware/upload.js";
import { authLimiter, uploadLimiter } from "../middleware/rateLimit.js";

import * as authCtrl from "../controllers/auth.controller.js";
import * as countryCtrl from "../controllers/country.controller.js";
import * as playerCtrl from "../controllers/player.controller.js";
import * as teamCtrl from "../controllers/team.controller.js";
import * as matchCtrl from "../controllers/match.controller.js";
import * as scoreCtrl from "../controllers/scoring.controller.js";
import * as streamCtrl from "../controllers/stream.controller.js";
import * as mediaCtrl from "../controllers/media.controller.js";
import * as statsCtrl from "../controllers/stats.controller.js";
import opsRouter from "./ops.routes.js";

const router = Router();

router.get("/health", (_req, res) =>
  res.json({ success: true, service: "bethub-api", time: new Date().toISOString(), uptime: process.uptime() })
);

// ── auth ─────────────────────────────────────────────────────
router.post("/auth/login", authLimiter, authCtrl.login);
router.get("/auth/me", auth, authCtrl.me);
router.patch("/auth/me", auth, authCtrl.updateProfile);
router.post("/auth/change-password", auth, authCtrl.changePassword);
router.get("/auth/session", auth, authCtrl.sessionInfo);

// ── countries ────────────────────────────────────────────────
router.get("/countries", countryCtrl.listCountries);
router.post("/countries", auth, requireAdmin, countryCtrl.createCountry);
router.patch("/countries/:id", auth, requireAdmin, countryCtrl.updateCountry);
router.delete("/countries/:id", auth, requireAdmin, countryCtrl.deleteCountry);

// ── players ──────────────────────────────────────────────────
router.get("/players", playerCtrl.listPlayers);
router.get("/players/:id", playerCtrl.getPlayer);
router.post("/players", auth, requireAdmin, playerCtrl.createPlayer);
router.post("/players/bulk", auth, requireAdmin, playerCtrl.bulkCreatePlayers);
router.patch("/players/:id", auth, requireAdmin, playerCtrl.updatePlayer);
router.delete("/players/:id", auth, requireAdmin, playerCtrl.deletePlayer);
router.post("/players/:id/restore", auth, requireAdmin, playerCtrl.restorePlayer);

// ── teams ────────────────────────────────────────────────────
router.get("/teams", teamCtrl.listTeams);
router.get("/teams/:id", teamCtrl.getTeam);
router.post("/teams", auth, requireAdmin, teamCtrl.createTeam);
router.patch("/teams/:id", auth, requireAdmin, teamCtrl.updateTeam);
router.patch("/teams/:id/archive", auth, requireAdmin, teamCtrl.archiveTeam);
router.delete("/teams/:id", auth, requireAdmin, teamCtrl.deleteTeam);

// ── matches ──────────────────────────────────────────────────
router.get("/matches", matchCtrl.listMatches);
router.get("/matches/:id", matchCtrl.getMatch);
router.post("/matches/:id/view", matchCtrl.registerView);
router.get("/matches/:id/chat", matchCtrl.getMatchChat);
router.get("/matches/:id/balls", scoreCtrl.listBalls);
router.get("/matches/:id/snapshot", scoreCtrl.scoreboardSnapshot);
router.post("/matches", auth, requireAdmin, matchCtrl.createMatch);
router.patch("/matches/:id", auth, requireAdmin, matchCtrl.updateMatch);
router.delete("/matches/:id", auth, requireAdmin, matchCtrl.deleteMatch);
router.post("/matches/:id/start", auth, requireAdmin, matchCtrl.startMatch);
router.post("/matches/:id/finish", auth, requireAdmin, matchCtrl.finishMatch);
router.post("/matches/:id/feature", auth, requireAdmin, matchCtrl.setFeatured);

// ── scoring ──────────────────────────────────────────────────
router.post("/matches/:id/ball", auth, requireAdmin, scoreCtrl.addBall);
router.post("/matches/:id/undo", auth, requireAdmin, scoreCtrl.undoBall);
router.post("/matches/:id/bowler", auth, requireAdmin, scoreCtrl.changeBowler);
router.post("/matches/:id/swap-strike", auth, requireAdmin, scoreCtrl.changeStrike);
router.post("/matches/:id/end-innings", auth, requireAdmin, scoreCtrl.finishInnings);
router.post("/matches/:id/commentary", auth, requireAdmin, scoreCtrl.addCommentary);
router.post("/matches/:id/reset", auth, requireAdmin, scoreCtrl.resetMatch);

// ── live streams ─────────────────────────────────────────────
router.get("/streams/config", streamCtrl.publicConfig);
router.get("/streams/live", streamCtrl.liveStreams);
router.get("/streams/recording-status", auth, requireAdmin, streamCtrl.recordingStatus);
router.get("/streams/by-slug/:slug", streamCtrl.streamBySlug);
router.post("/streams/:id/livekit/token", optionalAuth, streamCtrl.livekitToken);
router.post("/streams/:id/go-live", auth, requireAdmin, streamCtrl.goLive);
router.post("/streams/:id/end-live", auth, requireAdmin, streamCtrl.endLive);
router.post("/streams/:id/recording/start", auth, requireAdmin, streamCtrl.startRecording);
router.post("/streams/:id/recording/cancel", auth, requireAdmin, streamCtrl.cancelRecording);
router.post(
  "/streams/:id/recording/finish",
  auth,
  requireAdmin,
  uploadLimiter,
  videoUpload.single("file"),
  streamCtrl.finishRecording
);
router.delete("/streams/:id/recording", auth, requireAdmin, streamCtrl.removeRecording);
router.get("/streams/:id/qr", auth, requireAdmin, streamCtrl.streamQr);
router.post("/streams/:id/heartbeat", streamCtrl.streamHeartbeat);

// ── media ────────────────────────────────────────────────────
router.get("/media/videos", mediaCtrl.listVideos);
router.get("/media/videos/:id", mediaCtrl.getVideo);
router.post("/media/videos/:id/like", mediaCtrl.likeVideo);
router.get("/media/summary", auth, requireAdmin, mediaCtrl.mediaSummary);
router.post(
  "/media/image",
  auth,
  requireAdmin,
  uploadLimiter,
  imageUpload.single("file"),
  mediaCtrl.uploadImageAsset
);
router.post(
  "/media/video",
  auth,
  requireAdmin,
  uploadLimiter,
  videoUpload.single("file"),
  mediaCtrl.uploadVideoAsset
);
router.delete("/media/videos/:id", auth, requireAdmin, mediaCtrl.deleteVideo);

// ── stats ────────────────────────────────────────────────────
router.get("/stats/overview", statsCtrl.overview);
router.get("/stats/standings", statsCtrl.teamStandings);
router.get("/stats/leaderboard", statsCtrl.playerLeaderboard);
router.get("/stats/players/:id", statsCtrl.playerStats);
router.get("/stats/matches/:id", statsCtrl.matchInsights);
router.get("/stats/series", statsCtrl.seriesList);
router.get("/stats/analytics", statsCtrl.analytics);

// ── realtime ops centre ──────────────────────────────────────
router.use("/ops", opsRouter);

export default router;
