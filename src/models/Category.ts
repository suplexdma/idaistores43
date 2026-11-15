import { InferSchemaType, model, models, Schema } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
  },
  { timestamps: true },
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentCategory: 1 });

export type Category = InferSchemaType<typeof categorySchema>;

const CategoryModel = models.Category ?? model("Category", categorySchema);

export default CategoryModel;
