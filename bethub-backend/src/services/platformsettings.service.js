import PlatformSettings from "../models/PlatformSettings.model.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import logger from "../config/logger.js";
import { emitAdmin, emitAll } from "../realtime/emit.js";

export const SETTINGS_KEY = "platform";

export const LIMIT_FIELDS = ["maxLiveHours", "maxLiveMatches", "maxRecordings", "maxVideoMb", "maxImageMb"];

export const LIMIT_BOUNDS = {
  maxLiveHours: {
    label: "Live video limit",
    unit: "hours",
    min: 0.05,
    max: 24,
    step: 0.5,
    integer: false,
    hint: "Every live broadcast is auto-ended after this many hours.",
  },
  maxLiveMatches: {
    label: "Concurrent live matches",
    unit: "matches",
    min: 1,
    max: 50,
    step: 1,
    integer: true,
    hint: "How many grounds can be on air at the same time.",
  },
  maxRecordings: {
    label: "Concurrent recordings",
    unit: "recordings",
    min: 1,
    max: 50,
    step: 1,
    integer: true,
    hint: "How many live streams can be recorded at once.",
  },
  maxVideoMb: {
    label: "Video upload size",
    unit: "MB",
    min: 1,
    max: 2048,
    step: 25,
    integer: true,
    hint: "Maximum size for highlights, shorts, replays and recordings.",
  },
  maxImageMb: {
    label: "Image upload size",
    unit: "MB",
    min: 1,
    max: 200,
    step: 5,
    integer: true,
    hint: "Maximum size for logos, flags, avatars and thumbnails.",
  },
};

const round2 = (value) => Math.round(Number(value) * 100) / 100;

export const defaultLimits = () => ({
  maxLiveHours: round2(env.limits.maxLiveHours),
  maxLiveMatches: Math.round(env.limits.maxLiveMatches),
  maxRecordings: Math.round(env.limits.maxRecordings),
  maxVideoMb: Math.round(env.limits.maxVideoMb),
  maxImageMb: Math.round(env.limits.maxImageMb),
});

const pickLimits = (doc) => ({
  maxLiveHours: round2(doc.maxLiveHours),
  maxLiveMatches: Math.round(doc.maxLiveMatches),
  maxRecordings: Math.round(doc.maxRecordings),
  maxVideoMb: Math.round(doc.maxVideoMb),
  maxImageMb: Math.round(doc.maxImageMb),
});

let cache = { at: 0, value: null };
const CACHE_MS = 2500;

/**
 * Creates the singleton settings row on first boot and fills any missing
 * field from the environment defaults. Existing admin edits are preserved.
 */
export const ensureSettings = async () => {
  const defaults = defaultLimits();
  let doc = await PlatformSettings.findOne({ key: SETTINGS_KEY });
  if (!doc) {
    doc = await PlatformSettings.create({ key: SETTINGS_KEY, ...defaults });
    logger.ok(`Platform limits created · live ${doc.maxLiveHours}h · video ${doc.maxVideoMb}MB · image ${doc.maxImageMb}MB`);
  } else {
    const missing = {};
    for (const key of LIMIT_FIELDS) {
      if (doc[key] === undefined || doc[key] === null || !Number.isFinite(Number(doc[key]))) missing[key] = defaults[key];
    }
    if (Object.keys(missing).length) {
      Object.assign(doc, missing);
      await doc.save();
      logger.info(`Platform limits repaired · ${Object.keys(missing).join(", ")}`);
    }
  }
  cache = { at: Date.now(), value: pickLimits(doc) };
  return doc;
};

export const getSettingsDoc = async () => {
  const doc = await PlatformSettings.findOne({ key: SETTINGS_KEY });
  return doc || ensureSettings();
};

/** Cached live limits used by every upload, stream and match path. */
export const getLimits = async ({ fresh = false } = {}) => {
  if (!fresh && cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  const doc = await getSettingsDoc();
  const value = pickLimits(doc);
  cache = { at: Date.now(), value };
  return value;
};

export const validateLimitPatch = (patch = {}) => {
  const clean = {};
  for (const key of LIMIT_FIELDS) {
    if (patch[key] === undefined || patch[key] === null || patch[key] === "") continue;
    const bounds = LIMIT_BOUNDS[key];
    const numeric = Number(patch[key]);
    if (!Number.isFinite(numeric)) {
      throw ApiError.badRequest(`${bounds.label} must be a number`);
    }
    const value = bounds.integer ? Math.round(numeric) : round2(numeric);
    if (value < bounds.min || value > bounds.max) {
      throw ApiError.badRequest(
        `${bounds.label} must be between ${bounds.min} and ${bounds.max} ${bounds.unit}`,
        { field: key, min: bounds.min, max: bounds.max }
      );
    }
    clean[key] = value;
  }
  if (!Object.keys(clean).length) throw ApiError.badRequest("Change at least one platform limit");
  return clean;
};

export const limitsPayload = async () => {
  const doc = await getSettingsDoc();
  return {
    limits: pickLimits(doc),
    defaults: defaultLimits(),
    bounds: LIMIT_BOUNDS,
    updatedAt: doc.updatedAt,
    updatedByName: doc.updatedByName || "",
    source: "database",
  };
};

export const updateLimits = async (patch, user) => {
  const clean = validateLimitPatch(patch);
  const doc = await PlatformSettings.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $set: {
        ...clean,
        updatedBy: user?._id,
        updatedByName: user?.name || "",
      },
      $setOnInsert: { key: SETTINGS_KEY },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
  if (!doc) throw ApiError.server("Could not save the platform limits");
  cache = { at: Date.now(), value: pickLimits(doc) };

  const payload = {
    limits: pickLimits(doc),
    defaults: defaultLimits(),
    bounds: LIMIT_BOUNDS,
    updatedAt: doc.updatedAt,
    updatedByName: doc.updatedByName || "",
    source: "database",
  };
  emitAll("settings:limits", payload);
  emitAdmin("ops:limits", payload);
  return payload;
};

export const clearLimitCache = () => {
  cache = { at: 0, value: null };
};

export default { ensureSettings, getLimits, updateLimits, limitsPayload, defaultLimits, LIMIT_BOUNDS, LIMIT_FIELDS };
