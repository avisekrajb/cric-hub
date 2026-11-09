import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const required = ["MONGODB_URI"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[bethub] Missing required env: ${key}`);
    process.exit(1);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: process.env.NODE_ENV === "production",
  port: num(process.env.PORT, 5000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  publicUrl: process.env.PUBLIC_URL || process.env.CLIENT_URL || "http://localhost:5173",
  mongoUri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB || "bethub",
  jwtSecret: process.env.JWT_SECRET || "bethub_dev_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  admin: {
    name: process.env.ADMIN_NAME || "Bethub Admin",
    email: (process.env.ADMIN_EMAIL || "admin@bethub.com").toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "Bethub@123",
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  livekit: {
    url: (process.env.LIVEKIT_URL || "").replace(/\/$/, ""),
    apiKey: process.env.LIVEKIT_API_KEY || "",
    apiSecret: process.env.LIVEKIT_API_SECRET || "",
    tokenTtl: process.env.LIVEKIT_TOKEN_TTL || "6h",
  },
  limits: {
    maxLiveMatches: num(process.env.MAX_LIVE_MATCHES, 10),
    maxRecordings: num(process.env.MAX_CONCURRENT_RECORDINGS, 5),
    maxVideoMb: num(process.env.MAX_VIDEO_MB, 200),
    maxImageMb: num(process.env.MAX_IMAGE_MB, 50),
    maxLiveHours: num(process.env.MAX_LIVE_HOURS, 4),
  },
  turn: {
    url: process.env.TURN_URL || "",
    urls: process.env.TURN_URL ? [process.env.TURN_URL] : [],
    username: process.env.TURN_USERNAME || "",
    credential: process.env.TURN_CREDENTIAL || "",
  },
};

export default env;
