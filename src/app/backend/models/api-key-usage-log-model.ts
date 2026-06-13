import mongoose, { Schema } from "mongoose";
import { IApiKeyUsageLog } from "../types/auth-types";

const ApiKeyUsageLogSchema = new Schema<IApiKeyUsageLog>({
  apiKey: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true }, // Format: YYYY-MM-DD
  requestCount: { type: Number, required: true, default: 0 },
  errorCount: { type: Number, required: true, default: 0 },
  lastUsedAt: { type: Date, required: true, default: Date.now },
});

// Create compound index for fast updates and lookups per api-key per day
ApiKeyUsageLogSchema.index({ apiKey: 1, date: 1 }, { unique: true });

export default mongoose.models.ApiKeyUsageLog ||
  mongoose.model<IApiKeyUsageLog>("ApiKeyUsageLog", ApiKeyUsageLogSchema);
