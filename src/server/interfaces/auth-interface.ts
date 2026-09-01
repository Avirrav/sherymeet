import { NextRequest } from "next/server";
import { Document } from "mongoose";
import { IUser } from "./user-interface";
// --- Request Augmentation ---
export interface AuthenticatedRequest extends NextRequest {
  client?: IApiClient;
  user?: IUser;
  requestId?: string;
  rawBody?: Buffer;
  
}

export interface IRevokedApiKey extends Document {
  apiKey: string;
  revokedAt: Date;
  reason?: string;
}

export interface IApiClient extends Document {
  name: string;
  apiKey: string;
  createdBy?: string; // ObjectId of the platform User who created this client (dashboard self-service)
  createdByName?: string; // Denormalized snapshot of the creating user's name at creation time
  createdByAvatarUrl?: string; // Denormalized snapshot of the creating user's Google avatar at creation time
  currentSecret: string; // Encrypted with AWS KMS or fallback AES-256
  previousSecret?: string; // Encrypted with AWS KMS or fallback AES-256
  currentSecretVersion: number;
  previousSecretVersion?: number;
  allowedDomains: string[];
  allowRecording: boolean;
  status: 'active' | 'suspended';
  rateLimit: number; // requests/minute
  burstLimit: number; // requests/10 seconds
  dailyLimit: number; // requests/day
  revoked: boolean;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}