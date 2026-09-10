import crypto from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { IParticipant, ParticipantRole, ParticipantRoleHierarchy } from "@/types/roles";
import { logger } from "@/server/utils/logger";
import { ConferenceRoomDao } from "@/server/dao/conferenceroom-dao";
import { config } from "@/server/utils/config";
import { ConferenceRoomType } from "@/server/types/conferenceroom.types";
import { ApiError } from "@/server/utils/api-helper";

interface GenerateTokenOptions {
  roomId: string;
  participant: IParticipant;
}

export async function generateToken(options: GenerateTokenOptions): Promise<string> {
  const { roomId, participant } = options;
  const conferenceRoom = await ConferenceRoomDao.getConferenceRoomByRoomId(roomId);
  if (!conferenceRoom) {
    throw new ApiError(`Meet not found for roomId: ${roomId}. Cannot generate token.`, 404);
  }
  // Generate the secure identity (crypto-random suffix avoids collisions and
  // makes identities unguessable)
  const identity = `${participant.name}_${crypto.randomBytes(4).toString("hex")}`;
  // Create an AccessToken
  const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity,
    metadata: JSON.stringify({
      participant,
      roomId: roomId,
    }),
    name: participant.name,
    ttl: config.LIVEKIT_TOKEN_TTL,
  });
  const isCoHostorAbove =
    ParticipantRoleHierarchy[participant.role] >= ParticipantRoleHierarchy[ParticipantRole.CO_HOST];
  logger.debug(
    `Generating token for ${participant.name} (role: ${participant.role}, isCoHostorAbove: ${isCoHostorAbove}, meetType: ${conferenceRoom.type})`,
  );
  // If webinar only, only co-hosts and above can publish audio/video tracks.
  const canPublish = conferenceRoom.type === ConferenceRoomType.Webinar ? isCoHostorAbove : true;
  if (isCoHostorAbove) {
    at.addGrant({
      roomJoin: true,
      room: roomId,
      roomAdmin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
  } else {
    at.addGrant({
      room: roomId,
      roomJoin: true,
      canPublish: canPublish,
      canPublishData: true,
      canSubscribe: true,
    });
  }
  return await at.toJwt();
}
