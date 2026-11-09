import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

export const auth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized("Missing session token");

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized("Session expired, please sign in again");
  }

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw ApiError.unauthorized("Account is not available");
  req.user = user;
  next();
});

export const requireAdmin = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!["admin", "editor"].includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

/** Used by public endpoints that behave differently for a signed-in admin. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.id);
    if (user?.isActive) req.user = user;
  } catch {
    /* Treat a bad token as a guest. */
  }
  return next();
});

export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      socket.data.user = null;
      return next();
    }
    const payload = verifyToken(token);
    const user = await User.findById(payload.id);
    socket.data.user = user ? user.toSafeJSON() : null;
    return next();
  } catch {
    socket.data.user = null;
    return next();
  }
};

export default auth;
