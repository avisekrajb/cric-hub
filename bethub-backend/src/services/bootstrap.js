import User from "../models/User.model.js";
import logger from "../config/logger.js";
import env from "../config/env.js";
import { ensureFeatureFlags } from "./featureflag.service.js";
import { ensureSettings } from "./platformsettings.service.js";

export const ensureAdmin = async () => {
  const existing = await User.findOne({ email: env.admin.email });
  if (existing) {
    logger.info(`Admin ready → ${existing.email}`);
    return existing;
  }
  const admin = await User.create({
    name: env.admin.name,
    email: env.admin.email,
    password: env.admin.password,
    role: "admin",
  });
  logger.ok(`Admin account created → ${admin.email}`);
  logger.info("Change the default password from Admin → Settings");
  return admin;
};

export const bootstrap = async () => {
  const admin = await ensureAdmin();
  await ensureFeatureFlags();
  await ensureSettings();
  return admin;
};

export default ensureAdmin;
