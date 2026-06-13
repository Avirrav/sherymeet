import mongoose, { Schema } from "mongoose";
import { IAuditLog } from "../types/auth-types";

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
  timestamp: { type: Date, required: true, default: Date.now, index: true },
});

export default mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
