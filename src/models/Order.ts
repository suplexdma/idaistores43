import { InferSchemaType, model, models, Schema } from "mongoose";

const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, trim: true },
    image: { type: String, trim: true },
    variantName: { type: String, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, min: 0, default: null },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false },
);

const customerDetailsSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    area: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const shippingAddressSchema = new Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, trim: true },
    customerDetails: { type: customerDetailsSchema, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    items: { type: [orderItemSchema], required: true, validate: { validator: (items: unknown[]) => items.length > 0, message: "An order must contain at least one item." } },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, required: true, min: 0 },
    deliveryCharges: { type: Number, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["COD", "Online"], default: "COD", required: true },
    paymentStatus: { type: String, enum: ["Pending", "Partial", "Partially Paid", "Paid", "Refunded"], default: "Pending", index: true },
    amountReceived: { type: Number, min: 0, default: 0 },
    balanceAmount: { type: Number, min: 0, default: 0 },
    shippingAddress: { type: shippingAddressSchema, default: null },
    deliveryCompanyId: { type: Schema.Types.ObjectId, ref: "DeliveryCompany", default: null },
    deliveryDispatchId: { type: Schema.Types.ObjectId, ref: "DeliveryDispatch", default: null, index: true },
    deliveryCompany: { type: String, trim: true, maxlength: 120, default: "" },
    deliveryDate: { type: Date, default: null },
    estimatedArrival: { type: Date, default: null },
    trackingNumber: { type: String, trim: true, maxlength: 100, default: "" },
    statusHistory: {
      type: [{
        status: { type: String, required: true },
        timestamp: { type: Date, required: true, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
        note: { type: String, trim: true, maxlength: 500 },
      }],
      default: [],
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled", "Returned"],
      default: "Pending",
      index: true,
    },
    returnedAt: { type: Date, default: null, index: true },
    orderSource: {
      type: String,
      enum: ["Website", "WhatsApp", "AI", "AI Generated", "POS"],
      default: "Website",
      required: true,
      index: true,
    },
    internalNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
      select: false,
    },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderSource: 1, status: 1 });
orderSchema.index({ status: 1, returnedAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });

export type Order = InferSchemaType<typeof orderSchema>;

const OrderModel = models.Order ?? model("Order", orderSchema);

export default OrderModel;
