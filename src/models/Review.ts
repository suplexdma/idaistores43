import { InferSchemaType, model, models, Schema } from "mongoose";

const reviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    comment: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      required: true,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

export type Review = InferSchemaType<typeof reviewSchema>;

const ReviewModel = models.Review ?? model("Review", reviewSchema);

export default ReviewModel;
