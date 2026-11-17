import { InferSchemaType, model, models, Schema } from "mongoose";

const supplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
    address: { type: String, trim: true, maxlength: 500, default: "" },
    notes: { type: String, trim: true, maxlength: 1000, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

supplierSchema.index({ name: 1 });
supplierSchema.index({ active: 1, name: 1 });

export type Supplier = InferSchemaType<typeof supplierSchema>;

const SupplierModel = models.Supplier ?? model("Supplier", supplierSchema);

export default SupplierModel;
