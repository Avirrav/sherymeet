import { Document } from "mongoose";
import { UserRole } from "@/types/roles";

/**
 * IUserDocument — Mongoose document interface for the User collection.
 * Represents a platform user authenticated via Google OAuth (Login with Google).
 * Server-only (extends mongoose Document); the plain `IUser` shape and the
 * `UserRole` enum it uses live in the client-safe `@/types/roles`.
 */
export interface IUserDocument extends Document {
  googleId: string;
  email: string;
  userName: string;
  avatarUrl?: string;
  role: UserRole;
  status: "active" | "blocked";
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
