import mongoose from "mongoose";
import { VIDEO_TYPES } from "../utils/constants.js";

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: "", maxlength: 1200 },
    type: { type: String, enum: VIDEO_TYPES, default: "highlight", index: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", index: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    thumbnail: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
    format: { type: String, default: "mp4" },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

videoSchema.index({ createdAt: -1 });

export const Video = mongoose.model("Video", videoSchema);
export default Video;
