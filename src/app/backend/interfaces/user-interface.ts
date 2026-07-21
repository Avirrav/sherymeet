import { Document } from "mongoose";

export enum UserRole {
  BLOCKED = "blocked",
  DELETED = "deleted",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
  SERVICE_ACCOUNT = "service_account",
}

export interface IUser {
    _id: string;
    userName: string;
    role:UserRole;
    email:string;
    avatarUrl?: string;
}

export enum ParticipantRole {
    HOST = "host",
    CO_HOST="co_host",
    PARTICIPANT = "participant",
}

export interface IParticipant {
  name:string;
  role:ParticipantRole;
}

/**
 * IUserDocument — Mongoose document interface for the User collection.
 * Represents a platform user authenticated via Google OAuth (Login with Google).
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

export const UserRoleHierarchy = {
  [UserRole.BLOCKED]: -2,
  [UserRole.DELETED]: -1,
  [UserRole.SERVICE_ACCOUNT]: 0,
  [UserRole.ADMIN]: 1,
  [UserRole.SUPER_ADMIN]: 2
} as const;

export const ParticipantRoleHierarchy = {
  [ParticipantRole.PARTICIPANT]: 0,
  [ParticipantRole.CO_HOST]: 1,
  [ParticipantRole.HOST]: 2
} as const;


