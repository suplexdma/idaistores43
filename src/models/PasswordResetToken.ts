import { model, models, Schema } from "mongoose";

const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    tokenHash: { type: String, select: false },
    codeHash: { type: String, select: false },
    attempts: { type: Number, min: 0, default: 0 },
    cooldownUntil: { type: Date },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

const PasswordResetTokenModel =
  models.PasswordResetToken ??
  model("PasswordResetToken", passwordResetTokenSchema);

export default PasswordResetTokenModel;
