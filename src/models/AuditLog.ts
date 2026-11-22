import { InferSchemaType, model, models, Schema } from "mongoose";

const auditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  actorEmail: { type: String, trim: true, default: "" },
  action: { type: String, required: true, trim: true, maxlength: 120 },
  entityType: { type: String, required: true, trim: true, maxlength: 80 },
  entityId: { type: Schema.Types.ObjectId },
  changes: { type: Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, trim: true, default: "" },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export default models.AuditLog ?? model("AuditLog", auditLogSchema);
