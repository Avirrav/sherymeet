import { NextRequest } from "next/server";
import { Document } from "mongoose";
// Re-export interfaces and enums from other source files
export type { IApiClient, IRevokedApiKey } from "../interfaces/auth-interface";
export type { IUser } from "../interfaces/user-interface";
export { UserRole } from "../interfaces/user-interface";
import { IApiClient } from "../interfaces/auth-interface";
import { IUser } from "../interfaces/user-interface";

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
// This interface was accidentally commented out; restored to fix the build.
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

// --- Request Augmentation ---
export interface AuthenticatedRequest extends NextRequest {
  client?: IApiClient;
  user?: IUser;
  requestId?: string;
  rawBody?: Buffer;
}

// --- Chained Middleware Types ---
export type NextMiddleware = () => Promise<Response>;

export type AppMiddleware = (
  req: AuthenticatedRequest,
  next: NextMiddleware,
) => Promise<Response>;
