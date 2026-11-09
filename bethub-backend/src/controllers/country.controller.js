import Country from "../models/Country.model.js";
import Player from "../models/Player.model.js";
import Team from "../models/Team.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const listCountries = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.active !== "all") filter.isActive = true;
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: String(req.query.search), $options: "i" } },
      { code: { $regex: String(req.query.search), $options: "i" } },
    ];
  }
  const countries = await Country.find(filter).sort({ name: 1 }).lean();
  const [playerCounts, teamCounts] = await Promise.all([
    Player.aggregate([{ $group: { _id: "$country", count: { $sum: 1 } } }]),
    Team.aggregate([{ $group: { _id: "$country", count: { $sum: 1 } } }]),
  ]);
  const pmap = Object.fromEntries(playerCounts.map((c) => [String(c._id), c.count]));
  const tmap = Object.fromEntries(teamCounts.map((c) => [String(c._id), c.count]));
  res.json({
    success: true,
    countries: countries.map((c) => ({
      ...c,
      playerCount: pmap[String(c._id)] || 0,
      teamCount: tmap[String(c._id)] || 0,
    })),
  });
});

export const createCountry = asyncHandler(async (req, res) => {
  const { name, code, flag, color, isActive } = req.body || {};
  if (!name || !code) throw ApiError.badRequest("Country name and code are required");
  const exists = await Country.findOne({
    $or: [{ name: new RegExp(`^${String(name).trim()}$`, "i") }, { code: String(code).toUpperCase() }],
  });
  if (exists) throw ApiError.conflict("That country or code already exists");
  const country = await Country.create({
    name: String(name).trim(),
    code: String(code).trim(),
    flag: flag?.url ? { url: flag.url, publicId: flag.publicId || "" } : {},
    color: color || "#00e28a",
    isActive: isActive !== false,
    createdBy: req.user?._id,
  });
  res.status(201).json({ success: true, country });
});

export const updateCountry = asyncHandler(async (req, res) => {
  const country = await Country.findById(req.params.id);
  if (!country) throw ApiError.notFound("Country not found");
  const { name, code, flag, color, isActive } = req.body || {};
  if (name) country.name = String(name).trim();
  if (code) country.code = String(code).trim();
  if (flag !== undefined) country.flag = flag?.url ? { url: flag.url, publicId: flag.publicId || "" } : {};
  if (color) country.color = color;
  if (isActive !== undefined) country.isActive = Boolean(isActive);
  await country.save();
  res.json({ success: true, country });
});

export const deleteCountry = asyncHandler(async (req, res) => {
  const [players, teams] = await Promise.all([
    Player.countDocuments({ country: req.params.id }),
    Team.countDocuments({ country: req.params.id }),
  ]);
  if (players || teams) {
    throw ApiError.conflict(
      `This country is linked to ${players} player(s) and ${teams} team(s). Reassign or remove them first.`
    );
  }
  const country = await Country.findByIdAndDelete(req.params.id);
  if (!country) throw ApiError.notFound("Country not found");
  res.json({ success: true, message: "Country removed" });
});
