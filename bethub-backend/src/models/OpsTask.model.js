import mongoose from "mongoose";

const opsTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    status: { type: String, enum: ["todo", "doing", "done"], default: "todo", index: true },
    priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
    assignedTo: { type: String, default: "", trim: true, maxlength: 80 },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
    dueAt: Date,
    completedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String, default: "" },
  },
  { timestamps: true }
);

opsTaskSchema.index({ status: 1, priority: 1, dueAt: 1 });
opsTaskSchema.set("toJSON", { virtuals: true });

export const OpsTask = mongoose.model("OpsTask", opsTaskSchema);
export default OpsTask;
