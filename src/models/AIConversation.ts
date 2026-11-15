import { InferSchemaType, model, models, Schema } from "mongoose";

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant", "tool"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const toolCallSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    arguments: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const aiConversationSchema = new Schema(
  {
    sessionId: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    messages: { type: [messageSchema], default: [] },
    toolCalls: { type: [toolCallSchema], default: [] },
  },
  { timestamps: true },
);

aiConversationSchema.index({ sessionId: 1 }, { unique: true });
aiConversationSchema.index({ userId: 1, updatedAt: -1 });

export type AIConversation = InferSchemaType<typeof aiConversationSchema>;

const AIConversationModel =
  models.AIConversation ?? model("AIConversation", aiConversationSchema);

export default AIConversationModel;
