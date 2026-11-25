import { InferSchemaType, model, models, Schema } from "mongoose";

const onlinePaymentSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "primary" },
    jazzCashNumber: { type: String, trim: true, maxlength: 40, default: "" },
    easyPaisaNumber: { type: String, trim: true, maxlength: 40, default: "" },
    bankName: { type: String, trim: true, maxlength: 120, default: "" },
    accountTitle: { type: String, trim: true, maxlength: 120, default: "" },
    accountNumber: { type: String, trim: true, maxlength: 60, default: "" },
    iban: { type: String, trim: true, maxlength: 60, default: "" },
  },
  { timestamps: true },
);

export type OnlinePaymentSettings = InferSchemaType<typeof onlinePaymentSettingsSchema>;
export default models.OnlinePaymentSettings ?? model("OnlinePaymentSettings", onlinePaymentSettingsSchema);
