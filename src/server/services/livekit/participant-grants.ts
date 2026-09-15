import { TrackSource, type VideoGrant } from "livekit-server-sdk";
import { ParticipantRole } from "@/types/roles";

export function isAdminRole(role: ParticipantRole): boolean {
  return role === ParticipantRole.HOST || role === ParticipantRole.CO_HOST;
}

export function participantGrants(
  roomId: string,
  role: ParticipantRole,
  webinar: boolean,
): VideoGrant {
  const admin = isAdminRole(role);
  const panelist = role === ParticipantRole.PANELIST;
  return {
    room: roomId,
    roomJoin: true,
    roomAdmin: admin,
    canPublish: !webinar || admin || panelist,
    ...(webinar && panelist
      ? { canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA] }
      : {}),
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
  };
}
