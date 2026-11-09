import Team from "../models/Team.model.js";
import Player from "../models/Player.model.js";
import Country from "../models/Country.model.js";
import Match from "../models/Match.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const ensurePlayers = async (ids = []) => {
  const unique = [...new Set(ids.map(String))];
  if (!unique.length) return [];
  const players = await Player.find({ _id: { $in: unique } }).select("_id");
  if (players.length !== unique.length) throw ApiError.badRequest("One or more selected players no longer exist");
  return unique;
};

export const listTeams = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.active !== "all") filter.isActive = true;
  if (req.query.country) filter.country = req.query.country;
  if (req.query.search) filter.name = new RegExp(String(req.query.search), "i");
  const teams = await Team.find(filter)
    .populate("country")
    .populate("players", "name role photo isCaptain isWicketkeeper")
    .populate("captain", "name")
    .populate("wicketkeeper", "name")
    .sort({ name: 1 });
  res.json({ success: true, teams });
});

export const getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id)
    .populate("country")
    .populate({ path: "players", populate: { path: "country" } })
    .populate("captain")
    .populate("wicketkeeper");
  if (!team) throw ApiError.notFound("Team not found");
  const matches = await Match.find({ $or: [{ teamA: team._id }, { teamB: team._id }] })
    .sort({ startTime: -1 })
    .limit(10)
    .select("teamA teamB status startTime result series format");
  res.json({ success: true, team, matches });
});

export const createTeam = asyncHandler(async (req, res) => {
  const { name, shortName, country, logo, color, players = [], captain, wicketkeeper, coach, homeGround } = req.body || {};
  if (!name || !shortName || !country) throw ApiError.badRequest("Team name, short name and country are required");
  const exists = await Team.findOne({ name: new RegExp(`^${String(name).trim()}$`, "i") });
  if (exists) throw ApiError.conflict("A team with that name already exists");
  const countryDoc = await Country.findById(country);
  if (!countryDoc) throw ApiError.badRequest("Selected country does not exist");
  const playerIds = await ensurePlayers(players);

  const team = await Team.create({
    name: String(name).trim(),
    shortName: String(shortName).trim(),
    country,
    logo: logo?.url ? { url: logo.url, publicId: logo.publicId || "" } : { url: countryDoc.flag?.url || "", publicId: "" },
    color: color || countryDoc.color || "#00e28a",
    players: playerIds,
    captain: captain || undefined,
    wicketkeeper: wicketkeeper || undefined,
    coach,
    homeGround,
    createdBy: req.user?._id,
  });
  await team.populate(["country", { path: "players", populate: { path: "country" } }]);
  res.status(201).json({ success: true, team });
});

export const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw ApiError.notFound("Team not found");
  const { name, shortName, country, logo, color, players, captain, wicketkeeper, coach, homeGround, isActive } = req.body || {};

  if (name) team.name = String(name).trim();
  if (shortName) team.shortName = String(shortName).trim();
  if (country) team.country = country;
  if (logo !== undefined) team.logo = logo?.url ? { url: logo.url, publicId: logo.publicId || "" } : {};
  if (color) team.color = color;
  if (players !== undefined) team.players = await ensurePlayers(players);
  if (captain !== undefined) team.captain = captain || undefined;
  if (wicketkeeper !== undefined) team.wicketkeeper = wicketkeeper || undefined;
  if (coach !== undefined) team.coach = coach;
  if (homeGround !== undefined) team.homeGround = homeGround;
  if (isActive !== undefined) team.isActive = Boolean(isActive);
  await team.save();
  await team.populate(["country", { path: "players", populate: { path: "country" } }]);
  res.json({ success: true, team });
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const matchCount = await Match.countDocuments({ $or: [{ teamA: req.params.id }, { teamB: req.params.id }] });
  if (matchCount) {
    throw ApiError.conflict(`This team is used in ${matchCount} match(es). Archive it instead of deleting.`);
  }
  const team = await Team.findByIdAndDelete(req.params.id);
  if (!team) throw ApiError.notFound("Team not found");
  res.json({ success: true, message: "Team removed" });
});

export const archiveTeam = asyncHandler(async (req, res) => {
  const team = await Team.findByIdAndUpdate(req.params.id, { isActive: Boolean(req.body?.isActive) }, { new: true });
  if (!team) throw ApiError.notFound("Team not found");
  res.json({ success: true, team });
});
