import { InferSchemaType, model, models, Schema } from "mongoose";

const addressSchema = new Schema(
  {
    label: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    area: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    lastLoginAt: { type: Date },
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true });

export type User = InferSchemaType<typeof userSchema>;

const UserModel = models.User ?? model("User", userSchema);

export default UserModel;
