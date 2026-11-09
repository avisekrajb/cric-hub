import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    shortName: { type: String, required: true, trim: true, uppercase: true, maxlength: 6 },
    country: { type: mongoose.Schema.Types.ObjectId, ref: "Country", required: true },
    logo: { type: mediaSchema, default: () => ({}) },
    color: { type: String, default: "#00e28a" },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
    captain: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    wicketkeeper: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    coach: { type: String, trim: true, maxlength: 90, default: "" },
    homeGround: { type: String, trim: true, maxlength: 120, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

teamSchema.virtual("playerCount").get(function playerCount() {
  return Array.isArray(this.players) ? this.players.length : 0;
});

teamSchema.set("toJSON", { virtuals: true });

export const Team = mongoose.model("Team", teamSchema);
export default Team;
