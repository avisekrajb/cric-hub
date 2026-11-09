import mongoose from "mongoose";

/**
 * A single document holds the platform limits. Admins edit it from
 * Admin → Settings and every server path reads the live values, so no
 * restart is required when a limit is raised or lowered.
 */
const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "platform", index: true },
    maxLiveHours: { type: Number, default: 4, min: 0.05, max: 24 },
    maxLiveMatches: { type: Number, default: 10, min: 1, max: 50 },
    maxRecordings: { type: Number, default: 5, min: 1, max: 50 },
    maxVideoMb: { type: Number, default: 200, min: 1, max: 2048 },
    maxImageMb: { type: Number, default: 50, min: 1, max: 200 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedByName: { type: String, default: "" },
  },
  { timestamps: true }
);

platformSettingsSchema.set("toJSON", { virtuals: true });

export const PlatformSettings = mongoose.model("PlatformSettings", platformSettingsSchema);
export default PlatformSettings;
