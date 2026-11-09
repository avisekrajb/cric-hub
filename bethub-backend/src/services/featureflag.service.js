import FeatureFlag from "../models/FeatureFlag.model.js";
import { emitAll, emitAdmin } from "../realtime/emit.js";

export const DEFAULT_FLAGS = [
  {
    key: "chat_enabled",
    label: "Live chat",
    description: "Let fans send messages during live matches.",
    enabled: true,
  },
  {
    key: "reactions_enabled",
    label: "Live reactions",
    description: "Show emoji reactions on the live player.",
    enabled: true,
  },
  {
    key: "livekit_enabled",
    label: "LiveKit video",
    description: "Allow admins to broadcast camera feeds through LiveKit rooms.",
    enabled: true,
  },
  {
    key: "maintenance_mode",
    label: "Maintenance mode",
    description: "Pauses fan chat, shows a warning to admins and flags every public surface.",
    enabled: false,
  },
];

export const ensureFeatureFlags = async () => {
  await Promise.all(
    DEFAULT_FLAGS.map((flag) =>
      FeatureFlag.updateOne(
        { key: flag.key },
        {
          $setOnInsert: {
            key: flag.key,
            label: flag.label,
            description: flag.description,
            enabled: flag.enabled,
          },
        },
        { upsert: true }
      )
    )
  );
  return FeatureFlag.find().sort({ key: 1 });
};

export const listFlags = () => FeatureFlag.find().sort({ key: 1 });

export const getFlag = async (key, fallback = false) => {
  const doc = await FeatureFlag.findOne({ key });
  return doc ? Boolean(doc.enabled) : fallback;
};

export const flagSnapshot = async () => {
  const rows = await listFlags();
  return rows.reduce((acc, row) => {
    acc[row.key] = Boolean(row.enabled);
    return acc;
  }, {});
};

export const updateFlag = async (key, enabled, user) => {
  const doc = await FeatureFlag.findOneAndUpdate(
    { key },
    {
      $set: {
        enabled: Boolean(enabled),
        updatedBy: user?._id,
        updatedByName: user?.name || "",
      },
    },
    { new: true }
  );
  if (!doc) return null;
  const payload = doc.toJSON();
  emitAll("flag:update", payload);
  emitAdmin("ops:flag", payload);
  return payload;
};

export default { ensureFeatureFlags, listFlags, getFlag, flagSnapshot, updateFlag, DEFAULT_FLAGS };
