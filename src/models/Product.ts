import { InferSchemaType, model, models, Schema } from "mongoose";

const productImageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    alt: { type: String, trim: true },
  },
  { _id: false },
);

const productVariantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    price: { type: Number, min: 0 },
    salePrice: { type: Number, min: 0 },
    stock: { type: Number, min: 0, default: 0 },
    image: { type: productImageSchema, default: undefined },
  },
  { _id: false },
);

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    brand: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    categories: {
      type: [{ type: Schema.Types.ObjectId, ref: "Category" }],
      default: [],
    },
    shortDescription: { type: String, trim: true, maxlength: 300 },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, min: 0, select: false },
    compareAtPrice: { type: Number, min: 0 },
    salePrice: { type: Number, min: 0 },
    sku: { type: String, trim: true, uppercase: true },
    barcode: { type: String, trim: true },
    sellingUnit: { type: String, enum: ["Piece", "Pack", "Box", "Dozen"], default: "Piece" },
    unitConversions: {
      type: [{ unit: { type: String, enum: ["Piece", "Pack", "Box", "Dozen"], required: true }, piecesPerUnit: { type: Number, min: 1, required: true } }],
      default: [],
    },
    reservationMode: { type: String, enum: ["Placement", "Payment"], default: "Placement" },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 3 },
    images: { type: [productImageSchema], default: [] },
    specs: {
      type: [
        new Schema(
          {
            name: { type: String, required: true, trim: true },
            value: { type: String, required: true, trim: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    variants: { type: [productVariantSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ categories: 1, status: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ sku: 1 }, { unique: true, sparse: true });
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });
productSchema.index({ name: "text", brand: "text", description: "text" });

export type Product = InferSchemaType<typeof productSchema>;

const ProductModel = models.Product ?? model("Product", productSchema);

export default ProductModel;
