import { TrackSource, type VideoGrant } from "livekit-server-sdk";
import { ParticipantRole } from "@/types/roles";

export function isAdminRole(role: ParticipantRole): boolean {
  return role === ParticipantRole.HOST || role === ParticipantRole.CO_HOST;
}
export function participantGrants(
  roomId: string,
  role: ParticipantRole,
  webinar: boolean,
  microphoneAllowed = false,
): VideoGrant {
  const admin = isAdminRole(role);
  const panelist = role === ParticipantRole.PANELIST;
  return {
    room: roomId,
    roomJoin: true,
    roomAdmin: admin,
    canPublish: !webinar || admin || panelist || microphoneAllowed,
    ...(webinar && !admin && (panelist || microphoneAllowed)
      ? {
          canPublishSources: panelist
            ? [TrackSource.MICROPHONE, TrackSource.CAMERA]
            : [TrackSource.MICROPHONE],
        }
      : {}),
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
  };
}

/** Complete LiveKit permission preset; media sources remain independent of role labels. */
export function participantPermissions(
  role: ParticipantRole,
  webinar: boolean,
  microphoneAllowed = false,
) {
  const grants = participantGrants("", role, webinar, microphoneAllowed);
  return {
    canPublish: grants.canPublish === true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: grants.canPublishSources ?? [],
    canUpdateMetadata: false,
  };
}
