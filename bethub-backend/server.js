import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import mongoose from "mongoose";
import env from "./src/config/env.js";
import logger from "./src/config/logger.js";
import { connectDatabase } from "./src/config/db.js";
import { cloudinaryPing } from "./src/config/cloudinary.js";
import routes from "./src/routes/index.js";
import errorHandler from "./src/middleware/errorHandler.js";
import notFound from "./src/middleware/notFound.js";
import { apiLimiter } from "./src/middleware/rateLimit.js";
import { initRealtime } from "./src/realtime/index.js";
import { bootstrap } from "./src/services/bootstrap.js";
import { getLimits } from "./src/services/platformsettings.service.js";
import { startLiveWatchdog } from "./src/services/livewatchdog.service.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = new Set(
  [env.clientUrl, env.publicUrl, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"].filter(Boolean)
);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || env.nodeEnv !== "production") return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use((req, _res, next) => {
  if (!req.originalUrl.startsWith("/api/health") && req.method !== "OPTIONS") {
    logger.info(`${req.method} ${req.originalUrl}`);
  }
  next();
});

app.get("/", (_req, res) =>
  res.json({
    name: "Bethub API",
    tagline: "Live cricket. Live video. Realtime everything.",
    version: "1.0.0",
    health: "/api/health",
  })
);

app.use("/api", apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
initRealtime(server);
let stopWatchdog = null;

const start = async () => {
  try {
    await connectDatabase();
    await bootstrap();
    await cloudinaryPing();

    const limits = await getLimits({ fresh: true });
    stopWatchdog = startLiveWatchdog();

    server.listen(env.port, () => {
      logger.ok(`Bethub API listening on http://localhost:${env.port}`);
      logger.info(`Client origin: ${env.clientUrl}`);
      logger.info(
        `Limits · live ${limits.maxLiveHours}h · ${limits.maxLiveMatches} matches · recordings ${limits.maxRecordings} · video ${limits.maxVideoMb}MB · image ${limits.maxImageMb}MB`
      );
    });
  } catch (error) {
    logger.error("Failed to start Bethub API:", error.message);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  logger.warn(`${signal} received. Shutting down…`);
  stopWatchdog?.();
  server.close(() => logger.info("HTTP server closed"));
  try {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected");
  } catch {
    /* ignore */
  }
  setTimeout(() => process.exit(0), 800);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => logger.error("Unhandled rejection:", reason));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error.message);
});

start();

export default app;
