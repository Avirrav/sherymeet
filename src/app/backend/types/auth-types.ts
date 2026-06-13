import { NextRequest } from "next/server";
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
  | "startMeeting"
  | "endMeeting"
  | "joinMeeting";

export type RecordingPermission =
  | "startRecording"
  | "stopRecording"
  | "viewRecording"
  | "deleteRecording"
  | "downloadRecording";

export type OrganizationPermission =
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


// export interface IAuditLog extends Document {
//   requestId: string;
//   apiKey?: string;
//   userId?: string;
//   ip: string;
//   origin?: string;
//   method: string;
//   path: string;
//   eventType: string; // 'authentication_success' | 'invalid_signature' | etc.
//   status: number;
//   details?: string;
//   timestamp: Date;
// }

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
