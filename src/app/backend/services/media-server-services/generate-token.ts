import { AccessToken } from "livekit-server-sdk";
import {
  IParticipant,
  IUser,
  RoleHierarchy,
} from "@/app/backend/interfaces/user-interface";
import { UserRole } from "@/app/backend/interfaces/user-interface";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

interface GenerateTokenOptions {
  roomName: string;
  metadata?: string;
  user: IUser;
  participant: IParticipant;
}

export async function generateToken(
  options: GenerateTokenOptions,
): Promise<string> {
  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set");
  }
  const { roomName, user, participant } = options;
  // Generate the secure identity
  const identity = `${participant.participantName}_${Math.random().toString(36).substring(2, 6)}`;
  // Create an AccessToken
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    metadata: JSON.stringify({
      user,
      participant,
      roomName,
    }),
    name: participant.participantName,
    ttl: "2h", // Token valid for 2 hours
  });
  if (RoleHierarchy[participant.role] >= RoleHierarchy[UserRole.MENTOR]) {
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
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });
  }

  return await at.toJwt();
}
