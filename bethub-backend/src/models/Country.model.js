import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

const countrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 4,
      index: true,
    },
    flag: { type: mediaSchema, default: () => ({}) },
    color: { type: String, default: "#22c55e" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

countrySchema.virtual("playerCount", {
  ref: "Player",
  localField: "_id",
  foreignField: "country",
  count: true,
});

countrySchema.set("toJSON", { virtuals: true });

export const Country = mongoose.model("Country", countrySchema);
export default Country;
