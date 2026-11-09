import mongoose from "mongoose";
import { slugify } from "../utils/ids.js";
import { BATTING_STYLES, BOWLING_STYLES, ROLES } from "../utils/constants.js";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 90, index: true },
    slug: { type: String, index: true },
    country: { type: mongoose.Schema.Types.ObjectId, ref: "Country", required: true, index: true },
    role: { type: String, enum: ROLES, default: "Batter" },
    battingStyle: { type: String, enum: BATTING_STYLES, default: "Right-hand bat" },
    bowlingStyle: { type: String, enum: BOWLING_STYLES, default: "None" },
    jerseyNumber: { type: Number, min: 0, max: 999 },
    dateOfBirth: Date,
    birthplace: { type: String, trim: true, maxlength: 120 },
    height: { type: String, trim: true, maxlength: 30 },
    photo: { type: mediaSchema, default: () => ({}) },
    bio: { type: String, maxlength: 800, default: "" },
    isCaptain: { type: Boolean, default: false },
    isWicketkeeper: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

playerSchema.index({ name: "text", bio: "text", birthplace: "text" });

playerSchema.pre("save", function setSlug(next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = `${slugify(this.name)}-${String(this._id).slice(-5)}`;
  }
  next();
});

export const Player = mongoose.model("Player", playerSchema);
export default Player;
