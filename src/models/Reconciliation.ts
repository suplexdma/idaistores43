import { InferSchemaType, model, models, Schema } from "mongoose";

const reconciliationSchema = new Schema({
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ["Draft", "Reviewed", "Approved", "Finalized"], default: "Draft", index: true },
  sourceFileName: { type: String, trim: true, maxlength: 255, default: "" },
  paperBillRows: { type: [Schema.Types.Mixed], default: [] },
  differences: { type: [Schema.Types.Mixed], default: [] },
  adjustments: { type: [Schema.Types.Mixed], default: [] },
  approvedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  approvedAt: { type: Date, default: null },
  finalizedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  finalizedAt: { type: Date, default: null },
  auditTrail: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true });

reconciliationSchema.index({ startDate: 1, endDate: 1, status: 1 });
export type Reconciliation = InferSchemaType<typeof reconciliationSchema>;
export default models.Reconciliation ?? model("Reconciliation", reconciliationSchema);
