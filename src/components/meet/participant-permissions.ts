import { Participant } from 'livekit-client';
import {
  ParticipantRole,
  ParticipantRoleHierarchy,
} from '@/types/roles';

/**
 * Client-side mirrors of the server's token grants. The LiveKit token is the
 * real enforcement (participants in webinars get canPublish: false and the
 * server rejects publishes) — these helpers exist so the UI reflects the same
 * rules instead of letting users attempt actions that will fail.
 */

/** Reads the app role embedded in the participant's token metadata. */
export function getParticipantRole(participant: Participant | null): ParticipantRole {
  try {
    const meta = participant?.metadata ? JSON.parse(participant.metadata) : null;
    const role = meta?.participant?.role as ParticipantRole | undefined;
    if (role && role in ParticipantRoleHierarchy) {
      return role;
    }
  } catch {
    // Malformed metadata — treat as a regular participant.
  }
  return ParticipantRole.PARTICIPANT;
}

const ROLE_LABELS: Record<ParticipantRole, string> = {
  [ParticipantRole.HOST]: 'Host',
  [ParticipantRole.CO_HOST]: 'Co-host',
  [ParticipantRole.PARTICIPANT]: 'Participant',
};

/** Human-readable role label taken from the participant's own token. */
export function getParticipantRoleLabel(participant: Participant | null): string {
  return ROLE_LABELS[getParticipantRole(participant)];
}

/** Hosts and co-hosts: the only roles that can publish in a webinar. */
export function isCoHostOrAbove(participant: Participant | null): boolean {
  return (
    ParticipantRoleHierarchy[getParticipantRole(participant)] >=
    ParticipantRoleHierarchy[ParticipantRole.CO_HOST]
  );
}

/** The meeting host: the only role that may end the meeting for everyone. */
export function isHostRole(participant: Participant | null): boolean {
  return (
    ParticipantRoleHierarchy[getParticipantRole(participant)] >=
    ParticipantRoleHierarchy[ParticipantRole.HOST]
  );
}

/**
 * Whether the server granted this (local) participant publish rights.
 * `permissions` is populated by the server after connecting; treat a missing
 * value as allowed so regular meetings are unaffected.
 */
export function canParticipantPublish(participant: Participant | null): boolean {
  return participant?.permissions?.canPublish !== false;
}
