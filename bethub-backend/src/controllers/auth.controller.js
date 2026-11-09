import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { signToken } from "../middleware/auth.js";
import { logAudit } from "../services/audit.service.js";

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw ApiError.badRequest("Email and password are required");

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
  if (!user || !user.isActive) throw ApiError.unauthorized("Invalid email or password");

  const ok = await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized("Invalid email or password");

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  req.user = user;
  await logAudit({
    req,
    category: "auth",
    action: "auth.login",
    summary: `${user.name} signed in`,
    targetType: "user",
    targetId: user._id,
  });

  res.json({
    success: true,
    token: signToken(user),
    user: user.toSafeJSON(),
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, avatar } = req.body || {};
  const user = await User.findById(req.user._id);
  if (name) user.name = String(name).trim().slice(0, 80);
  if (avatar && typeof avatar === "object") {
    user.avatar = { url: avatar.url || "", publicId: avatar.publicId || "" };
  }
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, user: user.toSafeJSON() });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) throw ApiError.badRequest("Both passwords are required");
  if (String(newPassword).length < 6) throw ApiError.badRequest("New password must be at least 6 characters");

  const user = await User.findById(req.user._id).select("+password");
  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw ApiError.badRequest("Current password is incorrect");

  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: "Password updated", token: signToken(user) });
});

export const sessionInfo = asyncHandler(async (req, res) => {
  const payload = jwt.decode(req.headers.authorization?.slice(7) || "");
  res.json({ success: true, expiresAt: payload?.exp ? new Date(payload.exp * 1000) : null, user: req.user.toSafeJSON() });
});

export const adminHealth = asyncHandler(async (_req, res) => {
  res.json({ success: true, env: env.nodeEnv, uptime: process.uptime() });
});
