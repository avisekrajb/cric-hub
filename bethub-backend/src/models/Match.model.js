import mongoose from "mongoose";
import { FORMATS, MATCH_STATUS } from "../utils/constants.js";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  { _id: false }
);

const lineupPlayerSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    order: { type: Number, default: 0 },
    isCaptain: { type: Boolean, default: false },
    isKeeper: { type: Boolean, default: false },
  },
  { _id: false }
);

const dismissalSchema = new mongoose.Schema(
  {
    kind: { type: String, default: "" },
    text: { type: String, default: "" },
    bowler: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    fielder: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  },
  { _id: false }
);

const battingEntrySchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    position: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    out: { type: Boolean, default: false },
    dismissal: { type: dismissalSchema, default: () => ({}) },
  },
  { _id: false }
);

const bowlingEntrySchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    balls: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
  },
  { _id: false }
);

const fowSchema = new mongoose.Schema(
  {
    wicket: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    over: { type: String, default: "0.0" },
    player: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const partnershipSchema = new mongoose.Schema(
  {
    playerA: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    playerB: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    unbroken: { type: Boolean, default: true },
  },
  { _id: false }
);

const ballEventSchema = new mongoose.Schema(
  {
    over: { type: Number, default: 0 },
    ball: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    extraType: { type: String, default: "" },
    isWicket: { type: Boolean, default: false },
    label: { type: String, default: "" },
    batsman: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    bowler: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const overSchema = new mongoose.Schema(
  {
    number: { type: Number, default: 1 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    conceded: { type: Number, default: 0 },
    balls: { type: [ballEventSchema], default: [] },
    bowler: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const inningsSchema = new mongoose.Schema(
  {
    number: { type: Number, default: 0 },
    battingTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    bowlingTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    extras: {
      wides: { type: Number, default: 0 },
      noBalls: { type: Number, default: 0 },
      byes: { type: Number, default: 0 },
      legByes: { type: Number, default: 0 },
      penalty: { type: Number, default: 0 },
    },
    batting: { type: [battingEntrySchema], default: [] },
    bowling: { type: [bowlingEntrySchema], default: [] },
    fow: { type: [fowSchema], default: [] },
    overs: { type: [overSchema], default: [] },
    partnerships: { type: [partnershipSchema], default: [] },
    striker: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    nonStriker: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    bowler: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    lastBowler: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    needsBowler: { type: Boolean, default: false },
    freeHit: { type: Boolean, default: false },
    target: { type: Number, default: null },
    completed: { type: Boolean, default: false },
    declared: { type: Boolean, default: false },
    startedAt: Date,
    endedAt: Date,
  },
  { _id: false }
);

const streamSchema = new mongoose.Schema(
  {
    isLive: { type: Boolean, default: false },
    mode: { type: String, enum: ["hls", "embed", "camera", "livekit", ""], default: "" },
    title: { type: String, default: "" },
    hlsUrl: { type: String, default: "" },
    embedUrl: { type: String, default: "" },
    livekitRoom: { type: String, default: "" },
    playbackUrl: { type: String, default: "" },
    slug: { type: String, unique: true, sparse: true, index: true },
    streamKey: { type: String, default: "", select: false },
    startedAt: Date,
    endedAt: Date,
    recording: { type: Boolean, default: false },
    recordingStartedAt: Date,
    viewers: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    thumbnail: { type: String, default: "" },
    recordingUrl: { type: String, default: "" },
    recordingPublicId: { type: String, default: "" },
    recordingBytes: { type: Number, default: 0 },
    recordingDuration: { type: Number, default: 0 },
    lastHeartbeatAt: Date,
  },
  { _id: false }
);

const tossSchema = new mongoose.Schema(
  {
    winner: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    winnerSlot: { type: String, enum: ["A", "B", ""], default: "" },
    decision: { type: String, enum: ["bat", "bowl", ""], default: "" },
    text: { type: String, default: "" },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    winner: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
    winnerName: { type: String, default: "" },
    margin: { type: String, default: "" },
    text: { type: String, default: "" },
    tie: { type: Boolean, default: false },
    noResult: { type: Boolean, default: false },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    matchNumber: { type: Number, default: 1 },
    title: { type: String, default: "" },
    series: { type: String, default: "Bethub Series" },
    format: { type: String, enum: FORMATS, default: "T20" },
    overs: { type: Number, default: 20, min: 1, max: 450 },
    teamA: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    teamB: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    lineups: {
      A: { type: [lineupPlayerSchema], default: [] },
      B: { type: [lineupPlayerSchema], default: [] },
    },
    venue: { type: String, default: "" },
    city: { type: String, default: "" },
    startTime: { type: Date, default: Date.now },
    status: { type: String, enum: MATCH_STATUS, default: "upcoming", index: true },
    toss: { type: tossSchema, default: () => ({}) },
    currentInnings: { type: Number, default: 0 },
    innings: { type: [inningsSchema], default: [] },
    target: { type: Number, default: null },
    result: { type: resultSchema, default: () => ({}) },
    playerOfMatch: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    stream: { type: streamSchema, default: () => ({}) },
    officials: {
      umpires: { type: String, default: "" },
      referee: { type: String, default: "" },
      scorer: { type: String, default: "" },
    },
    undoStack: { type: [mongoose.Schema.Types.Mixed], default: [] },
    isFeatured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

matchSchema.index({ status: 1, startTime: -1 });
matchSchema.index({ series: 1, startTime: -1 });

matchSchema.virtual("teamSize").get(function teamSize() {
  const current = this.innings?.[this.currentInnings];
  if (!current) return 11;
  const slot = String(current.battingTeam) === String(this.teamA) ? "A" : "B";
  return this.lineups?.[slot]?.length || 11;
});

matchSchema.set("toJSON", { virtuals: true });

export const Match = mongoose.model("Match", matchSchema);
export default Match;
