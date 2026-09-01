import crypto from "crypto";
import { AccessToken } from "livekit-server-sdk";
import {
  IParticipant,
  ParticipantRole,
  ParticipantRoleHierarchy,
} from "@/types/roles";
import { logger } from "@/server/utils/logger";
import { MeetDao } from "@/server/dao/meet-dao";
import { config } from "@/server/utils/config";

const apiKey = config.LIVEKIT_API_KEY;
const apiSecret = config.LIVEKIT_API_SECRET;

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
  // Generate the secure identity (crypto-random suffix avoids collisions and
  // makes identities unguessable)
  const identity = `${participant.name}_${crypto.randomBytes(4).toString("hex")}`;
  // Create an AccessToken
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    metadata: JSON.stringify({
      participant,
      roomName,
    }),
    name: participant.name,
    // Long meetings need reconnects after the default window; keep this
    // configurable per deployment.
    ttl: config.LIVEKIT_TOKEN_TTL,
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
