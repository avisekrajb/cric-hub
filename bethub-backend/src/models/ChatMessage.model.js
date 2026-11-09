import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true, index: true },
    user: { type: String, required: true, trim: true, maxlength: 40 },
    avatarColor: { type: String, default: "#00e28a" },
    body: { type: String, required: true, trim: true, maxlength: 280 },
    isPinned: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    socketId: { type: String, default: "" },
  },
  { timestamps: true }
);

chatMessageSchema.index({ match: 1, createdAt: -1 });

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
export default ChatMessage;
