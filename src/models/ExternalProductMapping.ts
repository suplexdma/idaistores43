import { InferSchemaType, model, models, Schema } from "mongoose";

const externalProductMappingSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, unique: true },
  paperBillSku: { type: String, trim: true, uppercase: true, default: "" },
  paperBillBarcode: { type: String, trim: true, default: "" },
  paperBillName: { type: String, trim: true, maxlength: 200, default: "" },
}, { timestamps: true });

externalProductMappingSchema.index({ paperBillSku: 1 });
externalProductMappingSchema.index({ paperBillBarcode: 1 });
export type ExternalProductMapping = InferSchemaType<typeof externalProductMappingSchema>;
export default models.ExternalProductMapping ?? model("ExternalProductMapping", externalProductMappingSchema);
