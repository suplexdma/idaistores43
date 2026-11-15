import { InferSchemaType, model, models, Schema } from "mongoose";

const inventoryLogSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantityChanged: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => Number.isInteger(value) && value !== 0,
        message: "quantityChanged must be a non-zero integer.",
      },
    },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    adminId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
  },
  { timestamps: true },
);

inventoryLogSchema.index({ productId: 1, createdAt: -1 });
inventoryLogSchema.index({ adminId: 1, createdAt: -1 });

export type InventoryLog = InferSchemaType<typeof inventoryLogSchema>;

const InventoryLogModel =
  models.InventoryLog ?? model("InventoryLog", inventoryLogSchema);

export default InventoryLogModel;
