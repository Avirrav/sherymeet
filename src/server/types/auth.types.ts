import { NextRequest } from "next/server";
import { Document } from "mongoose";
import { IUser } from "@/types/roles";

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

// --- Roles & Permissions Definitions ---
export type MeetingPermission =
  | "createMeeting"
  | "updateMeeting"
  | "deleteMeeting"
  | "getMeeting"
  | "startMeeting"
  | "endMeeting"
  | "joinMeeting"
  | "muteParticipants"
  | "unmuteParticipants"
  | "removeParticipant"
  | "requestParticipantVideo"
  | "rejectParticipantVideo"
  | "acceptParticipantVideo"
  | "requestCoHost"
  | "acceptCoHost"
  | "rejectCoHost"
  | "createParticipantJoinUrl"
  | "getParticipantJoinUrl"
  | "deleteParticipantJoinUrl"

export type RecordingPermission =
  | "startRecording"
  | "stopRecording"
  | "viewRecording"
  | "deleteRecording"
  | "downloadRecording";

export type OrganizationPermission =
  | "createApiKey"
  | "manageApiKeys"
  | "manageMembers"
  | "manageBilling";

export type UserPermission =
  | "manageUsers"
  | "assignRoles"
  | "suspendUsers";

export type Permission =
  | MeetingPermission
  | RecordingPermission
  | OrganizationPermission
  | UserPermission;

// IAuditLog — Mongoose document interface for the AuditLog collection.
// Tracks every authenticated API request for security auditing.
export interface IAuditLog extends Document {
  requestId: string;        // Unique per-request ID (from x-request-id header)
  apiKey?: string;          // The API key used in the request
  userId?: string;          // The authenticated user's ID (if any)
  ip: string;               // Client IP address
  origin?: string;          // Request origin (from Origin header)
  method: string;           // HTTP method (GET, POST, etc.)
  path: string;             // Request path (/api/v1/...)
  eventType: string;        // e.g. 'authentication_success' | 'invalid_signature'
  status: number;           // HTTP response status code
  details?: string;         // Optional extra context (error messages, etc.)
  timestamp: Date;          // When the request was made
}

// IApiKeyUsageLog — Tracks daily request/error counts per API key.
// Used by ApiKeyUsageLog model for rate limiting and analytics dashboards.
export interface IApiKeyUsageLog extends Document {
  apiKey: string;           // The API key being tracked
  date: string;             // Format: YYYY-MM-DD (one document per key per day)
  requestCount: number;     // Total requests made on this date
  errorCount: number;       // Total failed requests on this date
  lastUsedAt: Date;         // Timestamp of the most recent request
}

// --- Chained Middleware Types ---
export type NextMiddleware = () => Promise<Response>;

export type AppMiddleware = (
  req: AuthenticatedRequest,
  next: NextMiddleware,
) => Promise<Response>;
