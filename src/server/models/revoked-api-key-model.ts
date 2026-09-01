import mongoose, { Schema } from "mongoose";
import { IRevokedApiKey } from "../types/auth.types";

const RevokedApiKeySchema = new Schema<IRevokedApiKey>({
  apiKey: { type: String, required: true, unique: true, index: true },
  revokedAt: { type: Date, required: true, default: Date.now },
  reason: { type: String },
});

export default mongoose.models.RevokedApiKey ||
  mongoose.model<IRevokedApiKey>("RevokedApiKey", RevokedApiKeySchema);
