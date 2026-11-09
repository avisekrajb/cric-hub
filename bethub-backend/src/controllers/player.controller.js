import Player from "../models/Player.model.js";
import Country from "../models/Country.model.js";
import Team from "../models/Team.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { BATTING_STYLES, BOWLING_STYLES, ROLES } from "../utils/constants.js";

const sanitize = (body = {}) => {
  const data = {};
  const fields = [
    "name",
    "role",
    "battingStyle",
    "bowlingStyle",
    "jerseyNumber",
    "dateOfBirth",
    "birthplace",
    "height",
    "bio",
    "isCaptain",
    "isWicketkeeper",
    "isActive",
    "country",
  ];
  for (const field of fields) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.photo !== undefined) {
    data.photo = body.photo?.url ? { url: body.photo.url, publicId: body.photo.publicId || "" } : {};
  }
  return data;
};

const validate = async (data) => {
  if (data.name !== undefined && !String(data.name).trim()) throw ApiError.badRequest("Player name is required");
  if (data.role && !ROLES.includes(data.role)) throw ApiError.badRequest("Invalid player role");
  if (data.battingStyle && !BATTING_STYLES.includes(data.battingStyle)) throw ApiError.badRequest("Invalid batting style");
  if (data.bowlingStyle && !BOWLING_STYLES.includes(data.bowlingStyle)) throw ApiError.badRequest("Invalid bowling style");
  if (data.country) {
    const country = await Country.findById(data.country);
    if (!country) throw ApiError.badRequest("Selected country does not exist");
  }
};

export const listPlayers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const filter = {};
  if (req.query.active !== "all") filter.isActive = true;
  if (req.query.country) filter.country = req.query.country;
  if (req.query.role) filter.role = req.query.role;
  if (req.query.team) filter._id = { $in: (await Team.findById(req.query.team).select("players"))?.players || [] };
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).trim(), "i");
    filter.$or = [{ name: rx }, { birthplace: rx }];
  }
  const [players, total] = await Promise.all([
    Player.find(filter)
      .populate("country")
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Player.countDocuments(filter),
  ]);
  res.json({ success: true, players, total, page, pages: Math.ceil(total / limit) });
});

export const getPlayer = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id).populate("country");
  if (!player) throw ApiError.notFound("Player not found");
  const teams = await Team.find({ players: player._id }).select("name shortName logo color");
  res.json({ success: true, player, teams });
});

export const createPlayer = asyncHandler(async (req, res) => {
  const data = sanitize(req.body);
  if (!data.name) throw ApiError.badRequest("Player name is required");
  if (!data.country) throw ApiError.badRequest("Choose a country for this player");
  await validate(data);
  const player = await Player.create({ ...data, createdBy: req.user?._id });
  await player.populate("country");
  res.status(201).json({ success: true, player });
});

export const updatePlayer = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) throw ApiError.notFound("Player not found");
  const data = sanitize(req.body);
  await validate(data);
  Object.assign(player, data);
  await player.save();
  await player.populate("country");
  res.json({ success: true, player });
});

export const deletePlayer = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) throw ApiError.notFound("Player not found");
  if (req.query.hard === "true") {
    await Team.updateMany({ players: player._id }, { $pull: { players: player._id } });
    await player.deleteOne();
    return res.json({ success: true, message: "Player permanently deleted" });
  }
  player.isActive = false;
  await player.save();
  res.json({ success: true, message: "Player archived. Career history is preserved.", player });
});

export const restorePlayer = asyncHandler(async (req, res) => {
  const player = await Player.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true }).populate("country");
  if (!player) throw ApiError.notFound("Player not found");
  res.json({ success: true, player });
});

export const bulkCreatePlayers = asyncHandler(async (req, res) => {
  const { players: rows } = req.body || {};
  if (!Array.isArray(rows) || !rows.length) throw ApiError.badRequest("Provide an array of players");
  const created = [];
  const errors = [];
  for (let i = 0; i < rows.length; i += 1) {
    try {
      const data = sanitize(rows[i]);
      if (!data.name || !data.country) throw new Error("name and country are required");
      await validate(data);
      created.push(await Player.create({ ...data, createdBy: req.user?._id }));
    } catch (error) {
      errors.push({ row: i + 1, message: error.message });
    }
  }
  res.status(201).json({ success: true, created: created.length, errors });
});
