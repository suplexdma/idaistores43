import { InferSchemaType, model, models, Schema } from "mongoose";

const postSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
    content: { type: String, required: true, trim: true, maxlength: 100000 },
    coverImage: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },
    metaTitle: { type: String, trim: true, maxlength: 180 },
    metaDescription: { type: String, trim: true, maxlength: 320 },
    status: { type: String, enum: ["Draft", "Published"], default: "Draft", index: true },
    publishedAt: { type: Date },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

postSchema.index({ slug: 1 }, { unique: true });

export type Post = InferSchemaType<typeof postSchema>;

const PostModel = models.Post ?? model("Post", postSchema);

export default PostModel;
