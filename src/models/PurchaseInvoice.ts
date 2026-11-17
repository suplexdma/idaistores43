import { InferSchemaType, model, models, Schema } from "mongoose";

const purchaseInvoiceSchema = new Schema(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierName: { type: String, required: true, trim: true },
    purchaseDate: { type: Date, required: true },
    invoiceNumber: { type: String, required: true, trim: true, uppercase: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    variantName: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    purchasePrice: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true },
  },
  { timestamps: true },
);

purchaseInvoiceSchema.index({ supplierId: 1, invoiceNumber: 1 }, { unique: true });
purchaseInvoiceSchema.index({ purchaseDate: -1 });
purchaseInvoiceSchema.index({ productId: 1, purchaseDate: -1 });
purchaseInvoiceSchema.index({ supplierId: 1, purchaseDate: -1 });

export type PurchaseInvoice = InferSchemaType<typeof purchaseInvoiceSchema>;

const PurchaseInvoiceModel =
  models.PurchaseInvoice ?? model("PurchaseInvoice", purchaseInvoiceSchema);

export default PurchaseInvoiceModel;
