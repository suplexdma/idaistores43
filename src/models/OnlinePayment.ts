import { InferSchemaType, model, models, Schema } from "mongoose";

const onlinePaymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    orderNumber: { type: String, required: true, trim: true, index: true },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    privateMessage: { type: String, trim: true, maxlength: 1000, default: "" },
    screenshotPublicId: { type: String, required: true, trim: true },
    screenshotFormat: { type: String, required: true, trim: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

onlinePaymentSchema.index({ createdAt: -1 });
export type OnlinePayment = InferSchemaType<typeof onlinePaymentSchema>;
export default models.OnlinePayment ?? model("OnlinePayment", onlinePaymentSchema);
