import { InferSchemaType, model, models, Schema } from "mongoose";

const deliveryCompanySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120, unique: true },
  contactNumber: { type: String, trim: true, maxlength: 30, default: "" },
  trackingUrlTemplate: { type: String, trim: true, maxlength: 500, default: "" },
  notes: { type: String, trim: true, maxlength: 1000, default: "" },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true });

deliveryCompanySchema.index({ name: 1 });
export type DeliveryCompany = InferSchemaType<typeof deliveryCompanySchema>;
export default models.DeliveryCompany ?? model("DeliveryCompany", deliveryCompanySchema);
