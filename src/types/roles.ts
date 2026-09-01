/**
 * Role vocabulary shared by the client and the server. Deliberately free of
 * server-only dependencies (no mongoose `Document`, no `next/server`) so it's
 * safe to import from client components/hooks as well as `src/server/`.
 *
 * The *authorization decisions* built on these roles (permission matrices,
 * DB document shapes) are server-only and live under `src/server/` — only
 * the shared vocabulary (the enums, the plain data shapes, the ordering)
 * belongs here.
 */

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
  role: UserRole;
  email: string;
  avatarUrl?: string;
}

export enum ParticipantRole {
  HOST = "host",
  CO_HOST = "co_host",
  PARTICIPANT = "participant",
}

export interface IParticipant {
  name: string;
  role: ParticipantRole;
}

export const UserRoleHierarchy = {
  [UserRole.BLOCKED]: -2,
  [UserRole.DELETED]: -1,
  [UserRole.SERVICE_ACCOUNT]: 0,
  [UserRole.ADMIN]: 1,
  [UserRole.SUPER_ADMIN]: 2,
} as const;

export const ParticipantRoleHierarchy = {
  [ParticipantRole.PARTICIPANT]: 0,
  [ParticipantRole.CO_HOST]: 1,
  [ParticipantRole.HOST]: 2,
} as const;
