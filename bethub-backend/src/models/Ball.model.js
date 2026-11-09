import mongoose from "mongoose";

const ballSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true, index: true },
    innings: { type: Number, default: 0 },
    over: { type: Number, required: true },
    ball: { type: Number, required: true },
    batsman: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    nonStriker: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    bowler: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    batRuns: { type: Number, default: 0 },
    extraType: { type: String, default: "" },
    extraRuns: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    isLegal: { type: Boolean, default: true },
    wicket: {
      isWicket: { type: Boolean, default: false },
      type: { type: String, default: "" },
      player: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
      fielder: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    },
    commentary: { type: String, default: "" },
    scoreAfter: {
      runs: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      balls: { type: Number, default: 0 },
      over: { type: String, default: "0.0" },
    },
    isFreeHit: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ballSchema.index({ match: 1, createdAt: -1 });

export const Ball = mongoose.model("Ball", ballSchema);
export default Ball;
