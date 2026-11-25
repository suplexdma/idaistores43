import { InferSchemaType, model, models, Schema } from "mongoose";

const deliveryCompanySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
  contactPersonName: { type: String, trim: true, maxlength: 120, default: "" },
  contactNumber: { type: String, trim: true, maxlength: 30, default: "" },
  officeLocation: { type: String, trim: true, maxlength: 300, default: "" },
  paymentMethod: { type: String, enum: ["Cash", "Bank Transfer"], default: "Cash" },
  paymentDelayDays: { type: Number, min: 0, max: 365, default: 0 },
  trackingUrlTemplate: { type: String, trim: true, maxlength: 500, default: "" },
  serviceRates: {
    type: [{
      minWeight: { type: Number, min: 0, required: true },
      maxWeight: { type: Number, min: 0, required: true },
      charge: { type: Number, min: 0, required: true },
    }],
    default: [],
  },
  customAttributes: {
    type: [{
      name: { type: String, trim: true, maxlength: 80, required: true },
      value: { type: String, trim: true, maxlength: 300, required: true },
    }],
    default: [],
  },
  notes: { type: String, trim: true, maxlength: 1000, default: "" },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true });

deliveryCompanySchema.index({ name: 1 });
export type DeliveryCompany = InferSchemaType<typeof deliveryCompanySchema>;
export default models.DeliveryCompany ?? model("DeliveryCompany", deliveryCompanySchema);
