import { v2 as cloudinary } from "cloudinary";
import fs from "node:fs/promises";
import env from "./env.js";
import logger from "./logger.js";

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

const cleanFolder = (folder = "bethub/misc") =>
  String(folder)
    .toLowerCase()
    .replace(/[^a-z0-9/_-]/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "")
    .slice(0, 80);

const safeUnlink = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    /* ignore */
  }
};

const thumbForVideo = (secureUrl) =>
  secureUrl.replace(/\.(mp4|webm|mov|m4v|avi|mkv|ogv)$/i, ".jpg");

const baseMeta = (result) => ({
  url: result.secure_url,
  publicId: result.public_id,
  bytes: result.bytes,
  format: result.format,
  width: result.width,
  height: result.height,
  duration: result.duration,
  createdAt: result.created_at || new Date().toISOString(),
});

export const uploadImage = async (filePath, folder = "bethub/images") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: cleanFolder(folder),
      resource_type: "image",
      transformation: [{ quality: "auto:good", fetch_format: "auto" }],
      overwrite: false,
    });
    return baseMeta(result);
  } finally {
    await safeUnlink(filePath);
  }
};

export const uploadVideo = async (filePath, folder = "bethub/videos") => {
  try {
    const stat = await fs.stat(filePath);
    const options = {
      folder: cleanFolder(folder),
      resource_type: "video",
      eager: [{ quality: "auto", fetch_format: "mp4" }],
      eager_async: true,
      overwrite: false,
    };
    // Cloudinary recommends chunked uploads for anything above ~90 MB
    const result =
      stat.size > 90 * 1024 * 1024
        ? await cloudinary.uploader.upload_large(filePath, {
            ...options,
            chunk_size: 8 * 1024 * 1024,
          })
        : await cloudinary.uploader.upload(filePath, options);
    return { ...baseMeta(result), thumbnail: thumbForVideo(result.secure_url) };
  } finally {
    await safeUnlink(filePath);
  }
};

export const destroyAsset = async (publicId, resourceType = "image") => {
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
  } catch (error) {
    logger.warn("Cloudinary destroy failed:", error.message);
    return null;
  }
};

export const cloudinaryPing = async () => {
  try {
    const res = await cloudinary.api.ping();
    logger.ok(`Cloudinary ready (${res.status}) · cloud=${env.cloudinary.cloudName}`);
    return true;
  } catch (error) {
    logger.warn("Cloudinary unreachable:", error.message);
    return false;
  }
};

export { cloudinary };
export default cloudinary;
