import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { getLimits } from "../services/platformsettings.service.js";

const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const videoTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/ogg",
  "video/x-msvideo",
]);

const rejectType = (message) => {
  const error = new Error(message);
  error.name = "UploadTypeError";
  error.statusCode = 415;
  return error;
};

const imageFilter = (_req, file, cb) => {
  if (!imageTypes.has(file.mimetype)) {
    return cb(rejectType("Only JPG, PNG, WEBP, GIF or AVIF images are allowed"));
  }
  cb(null, true);
};

const videoFilter = (_req, file, cb) => {
  if (!videoTypes.has(file.mimetype)) {
    return cb(rejectType("Only MP4, WEBM, MOV, MKV, OGG or AVI videos are allowed"));
  }
  cb(null, true);
};

/**
 * Builds a fresh Multer instance per request so the admin-controlled
 * size limit (video MB / image MB) is applied immediately after saving
 * in Admin → Settings. No server restart required.
 */
const makeDynamicUploader = (kind) => {
  const isImage = kind === "image";
  return {
    single: (field) => async (req, res, next) => {
      try {
        const limits = await getLimits();
        const maxMb = Math.max(1, Math.round(isImage ? limits.maxImageMb : limits.maxVideoMb));
        const uploader = multer({
          storage,
          fileFilter: isImage ? imageFilter : videoFilter,
          limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
        });
        uploader.single(field)(req, res, (error) => {
          if (!error) {
            req.uploadLimitMb = maxMb;
            return next();
          }
          if (error.code === "LIMIT_FILE_SIZE") {
            error.limitMb = maxMb;
            error.message = `File is too large. The current ${isImage ? "image" : "video"} limit is ${maxMb} MB — an admin can raise it in Settings.`;
          }
          next(error);
        });
      } catch (error) {
        next(error);
      }
    },
  };
};

export const imageUpload = makeDynamicUploader("image");
export const videoUpload = makeDynamicUploader("video");

export { uploadDir };
export default { imageUpload, videoUpload };
