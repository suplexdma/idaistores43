import { InferSchemaType, model, models, Schema } from "mongoose";

const trashEntrySchema = new Schema(
  {
    entityType: {
      type: String,
      enum: ["product", "order", "post", "note", "task"],
      required: true,
      index: true,
    },
    originalId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    payload: { type: Schema.Types.Mixed, required: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true },
);

trashEntrySchema.index({ createdAt: -1 });

export type TrashEntry = InferSchemaType<typeof trashEntrySchema>;

const TrashEntryModel = models.TrashEntry ?? model("TrashEntry", trashEntrySchema);

export default TrashEntryModel;
