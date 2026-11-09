import AuditLog from "../models/AuditLog.model.js";
import logger from "../config/logger.js";
import { emitAdmin } from "../realtime/emit.js";

/**
 * Writes an immutable admin activity entry and pushes it to every open
 * control-room socket. Never throws — audit failures must not break an action.
 */
export const logAudit = async ({
  req,
  category = "system",
  action,
  summary = "",
  targetType = "",
  targetId = "",
  meta = {},
} = {}) => {
  try {
    const actor = req?.user
      ? {
          id: req.user._id,
          name: req.user.name || "Admin",
          email: req.user.email || "",
          role: req.user.role || "admin",
        }
      : { name: "System", role: "system" };

    const doc = await AuditLog.create({
      actor,
      category,
      action,
      summary,
      targetType,
      targetId: targetId ? String(targetId) : "",
      meta,
      ip: req?.ip || "",
      at: new Date(),
    });

    emitAdmin("ops:audit", doc.toJSON());
    return doc;
  } catch (error) {
    logger.warn("audit log failed:", error.message);
    return null;
  }
};

export default logAudit;
