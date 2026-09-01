import mongoose, { Schema } from "mongoose";
import { IAuditLog } from "../types/auth.types";
import { config } from "../utils/config";

const AuditLogSchema = new Schema<IAuditLog>({
  requestId: { type: String, required: true, index: true },
  apiKey: { type: String, index: true },
  userId: { type: String, index: true },
  ip: { type: String, required: true },
  origin: { type: String },
  method: { type: String, required: true },
  path: { type: String, required: true },
  eventType: { type: String, required: true, index: true },
  status: { type: Number, required: true },
  details: { type: String },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
    // TTL index: audit logs are pruned automatically so the collection
    // doesn't grow without bound. Configurable in days via AUDIT_LOG_TTL_DAYS.
    expires: 60 * 60 * 24 * config.AUDIT_LOG_TTL_DAYS,
  },
});

export default mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
