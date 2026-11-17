import { InferSchemaType, model, models, Schema } from "mongoose";

const inventoryLogSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantName: { type: String, trim: true },
    movementDate: { type: Date, required: true, default: Date.now },
    quantityChanged: {
      type: Number,
      required: true,
      validate: {
        validator: (value: number) => Number.isInteger(value) && value !== 0,
        message: "quantityChanged must be a non-zero integer.",
      },
    },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    source: {
      type: String,
      enum: ["Manual", "Purchase", "Website", "AI", "POS", "Cancellation"],
      default: "Manual",
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId },
    remainingStock: { type: Number, min: 0 },
    adminId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true },
);

inventoryLogSchema.index({ productId: 1, createdAt: -1 });
inventoryLogSchema.index({ productId: 1, movementDate: -1 });
inventoryLogSchema.index({ adminId: 1, createdAt: -1 });
inventoryLogSchema.index({ createdAt: -1, _id: -1 });
inventoryLogSchema.index({ movementDate: -1, _id: -1 });

export type InventoryLog = InferSchemaType<typeof inventoryLogSchema>;

const InventoryLogModel =
  models.InventoryLog ?? model("InventoryLog", inventoryLogSchema);

export default InventoryLogModel;
