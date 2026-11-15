import { InferSchemaType, model, models, Schema } from "mongoose";

const adminUserSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: "" },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["SuperAdmin", "Manager", "Support"],
      required: true,
      default: "Support",
    },
    accessLevel: {
      type: String,
      enum: ["View Only", "Editor", "Full Access"],
      default: undefined,
      index: true,
    },
  },
  { timestamps: true },
);

export type AdminUser = InferSchemaType<typeof adminUserSchema>;

const AdminUserModel = models.AdminUser ?? model("AdminUser", adminUserSchema);

export default AdminUserModel;
