import { InferSchemaType, model, models, Schema } from "mongoose";

const deliveryDispatchSchema = new Schema(
  {
    dispatchNumber: { type: String, required: true, unique: true, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: "DeliveryCompany", required: true, index: true },
    orderIds: { type: [{ type: Schema.Types.ObjectId, ref: "Order" }], default: [] },
    dispatchDate: { type: Date, required: true },
    courierCharges: { type: Number, min: 0, default: 0 },
    receivedAmount: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["Dispatched", "Partial", "Received"], default: "Dispatched" },
  },
  { timestamps: true },
);

deliveryDispatchSchema.index(
  { companyId: 1, dispatchDate: 1 },
  { unique: true, partialFilterExpression: { status: "Dispatched" } },
);
deliveryDispatchSchema.index({ dispatchDate: -1 });

export type DeliveryDispatch = InferSchemaType<typeof deliveryDispatchSchema>;
export default models.DeliveryDispatch ?? model("DeliveryDispatch", deliveryDispatchSchema);
