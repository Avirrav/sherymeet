import mongoose, { Schema } from "mongoose";
import { IUserDocument } from "../types/user.types";
import { UserRole } from "@/types/roles";
import { config } from "../utils/config";

const UserSchema = new Schema<IUserDocument>(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    userName: { type: String, required: true },
    avatarUrl: { type: String },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.SERVICE_ACCOUNT },
    status: { type: String, enum: ["active", "blocked"], default: "active" },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

if (config.NODE_ENV === "development" && mongoose.models.User) {
  delete mongoose.models.User;
}

export default mongoose.models.User ||
  mongoose.model<IUserDocument>("User", UserSchema);
