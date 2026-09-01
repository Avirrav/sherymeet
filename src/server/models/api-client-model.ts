import mongoose, { Schema } from "mongoose";
import { IApiClient } from "../types/auth.types";
import { config } from "../utils/config";

const ApiClientSchema = new Schema<IApiClient>(
  {
    name: { type: String, required: true },
    apiKey: { type: String, required: true, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    createdByName: { type: String },
    createdByAvatarUrl: { type: String },
    currentSecret: { type: String, required: true },
    previousSecret: { type: String },
    currentSecretVersion: { type: Number, required: true, default: 1 },
    previousSecretVersion: { type: Number },
    allowedDomains: { type: [String], default: [] },
    allowRecording: { type: Boolean, required: true, default: false },
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    rateLimit: { type: Number, required: true, default: 100 }, // requests/minute
    burstLimit: { type: Number, required: true, default: 20 }, // requests/10 seconds
    dailyLimit: { type: Number, required: true, default: 50000 }, // requests/day
    revoked: { type: Boolean, required: true, default: false },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

if (config.NODE_ENV === "development" && mongoose.models.ApiClient) {
  delete mongoose.models.ApiClient;
}

export default mongoose.models.ApiClient ||
  mongoose.model<IApiClient>("ApiClient", ApiClientSchema);
