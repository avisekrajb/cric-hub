import mongoose from "mongoose";

const featureFlagSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    enabled: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedByName: { type: String, default: "" },
  },
  { timestamps: true }
);

featureFlagSchema.set("toJSON", { virtuals: true });

export const FeatureFlag = mongoose.model("FeatureFlag", featureFlagSchema);
export default FeatureFlag;
