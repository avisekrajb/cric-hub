import Video from "../models/Video.model.js";
import Match from "../models/Match.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { destroyAsset, uploadImage, uploadVideo } from "../config/cloudinary.js";
import { VIDEO_TYPES } from "../utils/constants.js";
import { announce } from "../realtime/broadcast.js";
import { getLimits } from "../services/platformsettings.service.js";

const FOLDERS = new Set(["countries", "players", "teams", "media", "avatars", "thumbnails", "misc"]);

export const uploadImageAsset = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Choose an image to upload");
  const folder = FOLDERS.has(String(req.body?.folder)) ? String(req.body.folder) : "misc";
  const uploaded = await uploadImage(req.file.path, `bethub/${folder}`);
  res.status(201).json({
    success: true,
    media: {
      url: uploaded.url,
      publicId: uploaded.publicId,
      bytes: uploaded.bytes,
      width: uploaded.width,
      height: uploaded.height,
      format: uploaded.format,
      folder,
    },
    limits: { maxImageMb: (await getLimits()).maxImageMb },
  });
});

export const uploadVideoAsset = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Choose a video to upload");
  const type = VIDEO_TYPES.includes(req.body?.type) ? req.body.type : "highlight";
  const title = String(req.body?.title || "").trim().slice(0, 140) || "Bethub video";
  const description = String(req.body?.description || "").trim().slice(0, 1200);
  const matchId = req.body?.matchId || null;

  if (matchId) {
    const match = await Match.findById(matchId);
    if (!match) throw ApiError.badRequest("Selected match no longer exists");
  }

  const uploaded = await uploadVideo(req.file.path, `bethub/${type === "short" ? "shorts" : "videos"}`);
  const video = await Video.create({
    title,
    description,
    type,
    match: matchId || undefined,
    url: uploaded.url,
    publicId: uploaded.publicId,
    thumbnail: uploaded.thumbnail,
    duration: Number(req.body?.duration) || uploaded.duration || 0,
    bytes: uploaded.bytes,
    format: uploaded.format,
    createdBy: req.user?._id,
  });

  if (type === "short" || type === "highlight") {
    announce({
      type: "video",
      title: "New video on Bethub",
      body: title,
      videoId: video._id,
      icon: "video",
    });
  }

  res.status(201).json({
    success: true,
    video,
    limits: { maxVideoMb: (await getLimits()).maxVideoMb },
  });
});

export const listVideos = asyncHandler(async (req, res) => {
  const { type, match, search, limit = 24, page = 1, featured } = req.query;
  const filter = {};
  if (type && type !== "all") filter.type = type;
  if (match) filter.match = match;
  if (featured === "true") filter.isFeatured = true;
  if (search) filter.title = new RegExp(String(search), "i");
  const perPage = Math.min(60, Math.max(1, Number(limit) || 24));
  const current = Math.max(1, Number(page) || 1);
  const [videos, total] = await Promise.all([
    Video.find(filter)
      .populate({ path: "match", select: "teamA teamB series" })
      .sort({ createdAt: -1 })
      .skip((current - 1) * perPage)
      .limit(perPage),
    Video.countDocuments(filter),
  ]);
  res.json({ success: true, videos, total, page: current, pages: Math.ceil(total / perPage) });
});

export const getVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id).populate({ path: "match", select: "teamA teamB series status" });
  if (!video) throw ApiError.notFound("Video not found");
  video.views += 1;
  await video.save({ validateBeforeSave: false });
  res.json({ success: true, video });
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) throw ApiError.notFound("Video not found");
  const isCloudinaryAsset = !video.publicId.startsWith("seed/");
  if (isCloudinaryAsset) await destroyAsset(video.publicId, "video");
  await video.deleteOne();
  res.json({ success: true, message: "Video deleted" });
});

export const likeVideo = asyncHandler(async (req, res) => {
  const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true, select: "likes" });
  if (!video) throw ApiError.notFound("Video not found");
  res.json({ success: true, likes: video.likes });
});

export const mediaSummary = asyncHandler(async (_req, res) => {
  const rows = await Video.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 }, bytes: { $sum: "$bytes" }, views: { $sum: "$views" } } },
  ]);
  const summary = { short: 0, long: 0, highlight: 0, replay: 0 };
  let bytes = 0;
  let views = 0;
  for (const row of rows) {
    summary[row._id] = row.count;
    bytes += row.bytes;
    views += row.views;
  }
  const limits = await getLimits();
  res.json({ success: true, summary, bytes, views, limits: { maxVideoMb: limits.maxVideoMb, maxImageMb: limits.maxImageMb } });
});
