import { AccessToken } from "livekit-server-sdk";
import {
  IParticipant,
  ParticipantRole,
  ParticipantRoleHierarchy,
} from "@/app/backend/interfaces/user-interface";
import { logger } from "@/app/backend/utils/logger";
import { MeetDao } from "@/app/backend/dao/meet-dao";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

interface GenerateTokenOptions {
  roomName: string;
  metadata?: string;
  participant: IParticipant;
}

export async function generateToken(
  options: GenerateTokenOptions,
): Promise<string> {
  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set");
  }
  const { roomName, participant } = options;
  // Generate the secure identity
  const identity = `${participant.name}_${Math.random().toString(36).substring(2, 6)}`;
  // Create an AccessToken
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    metadata: JSON.stringify({
      participant,
      roomName,
    }),
    name: participant.name,
    ttl: "2h", // Token valid for 2 hours
  });
  let meetType: "webinar" | "meet" = "meet";
  try {
    const meet = await MeetDao.getMeetByRoomId(roomName);
    if (meet && meet.type) {
      meetType = meet.type;
    }
  } catch (err) {
    logger.warn(`Failed to fetch meeting type for room: ${roomName}, defaulting to meet`, err);
  }
  const isCoHostorAbove = ParticipantRoleHierarchy[participant.role] >= ParticipantRoleHierarchy[ParticipantRole.CO_HOST];
  logger.debug(`Generating token for ${participant.name} (role: ${participant.role}, isCoHostorAbove: ${isCoHostorAbove}, meetType: ${meetType})`);
  // If webinar only, only co-hosts and above can publish audio/video tracks.
  const canPublish = meetType === "webinar" ? isCoHostorAbove : true;
  if (isCoHostorAbove) {
    at.addGrant({
      roomJoin: true,
      room: roomName,
      roomAdmin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
  } else {
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: canPublish,
      canPublishData: true,
      canSubscribe: true,
    });
  }
  return await at.toJwt();
}
