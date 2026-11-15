import { InferSchemaType, model, models, Schema } from "mongoose";

const adminNoteTaskSchema = new Schema(
  {
    kind: { type: String, enum: ["note", "task"], required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    content: { type: String, trim: true, maxlength: 10000, default: "" },
    dueDate: { type: Date },
    completed: { type: Boolean, default: false },
    assignee: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    favorite: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

adminNoteTaskSchema.index({ pinned: -1, favorite: -1, updatedAt: -1 });

export type AdminNoteTask = InferSchemaType<typeof adminNoteTaskSchema>;

const AdminNoteTaskModel = models.AdminNoteTask ?? model("AdminNoteTask", adminNoteTaskSchema);

export default AdminNoteTaskModel;
