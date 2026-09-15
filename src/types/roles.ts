/**
 * Meeting-participant role vocabulary shared by the client and the server.
 * Deliberately free of server-only dependencies (no mongoose `Document`, no
 * `next/server`) so it's safe to import from client components/hooks as
 * well as `src/server/`.
 *
 * Sherymeet is single-tenant: there is no platform-user/login concept, only
 * one HMAC-authenticated API client (see `src/server/services/auth/api-client.ts`)
 * and, within a meeting, participant roles (host/co-host/participant) below.
 */

export enum ParticipantRole {
  HOST = "host",
  CO_HOST = "co_host",
  PARTICIPANT = "participant",
  PANELIST = "panelist",
}

export interface IParticipant {
  name: string;
  role: ParticipantRole;
  email?: string;
}

export const ParticipantRoleHierarchy = {
  [ParticipantRole.PARTICIPANT]: 0,
  [ParticipantRole.PANELIST]: 1,
  [ParticipantRole.CO_HOST]: 2,
  [ParticipantRole.HOST]: 3,
} as const;
