import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "System" },
      email: { type: String, default: "" },
      role: { type: String, default: "admin" },
    },
    category: {
      type: String,
      enum: ["match", "stream", "chat", "task", "flag", "announcement", "export", "auth", "settings", "system"],
      default: "system",
      index: true,
    },
    action: { type: String, required: true, trim: true, maxlength: 80, index: true },
    summary: { type: String, default: "", trim: true, maxlength: 400 },
    targetType: { type: String, default: "", trim: true, maxlength: 40 },
    targetId: { type: String, default: "", trim: true, maxlength: 80 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

auditLogSchema.index({ at: -1, category: 1 });
auditLogSchema.set("toJSON", { virtuals: true });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
