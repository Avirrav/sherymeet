import { AccessToken } from "livekit-server-sdk";
import { ParticipantRole } from "@/types/roles";
import { RoomMember } from "@/server/models/room-member";
import { dbConnect } from "@/server/utils/db-connect";
import { config } from "@/server/utils/config";
import { ApiError } from "@/server/utils/api-helper";
import { VerifiedRoomToken } from "./verify-room-token";
import { participantGrants, isAdminRole } from "./participant-grants";

// Reconcile saved application roles before connecting. Do not extend the
// original credential's lifetime or import authority from client metadata.
export async function refreshRoomToken(
  original: string,
  verified: VerifiedRoomToken,
  roomId: string,
  webinar: boolean,
) {
  const { claims, identity } = verified;
  if (claims.video?.hidden || claims.video?.recorder) return original;
  await dbConnect();
  let member = await RoomMember.findOne({ roomId, identity });
  if (!member) {
    let participant;
    try {
      participant = JSON.parse(claims.metadata || "{}").participant;
    } catch {
      return original;
    }
    if (!participant || !Object.values(ParticipantRole).includes(participant.role)) return original;
    const role = participant.role as ParticipantRole;
    if (isAdminRole(role) && !verified.roomAdmin) throw new ApiError("Invalid admin role", 403);
    member = await RoomMember.findOneAndUpdate(
      { roomId, identity },
      {
        $setOnInsert: {
          roomId,
          identity,
          role,
          name: claims.name || participant.name || identity,
          email:
            typeof participant.email === "string"
              ? participant.email.trim().toLowerCase()
              : undefined,
        },
      },
      { upsert: true, new: true },
    );
  }
  if (!member || member.lockUntil > new Date())
    throw new ApiError("Permissions are changing; retry shortly", 409);
  // Admin grants are not renewable through the panel flow.
  if (isAdminRole(member.role)) return original;
  const ttl = (claims.exp || 0) - Math.ceil(Date.now() / 1000);
  if (ttl <= 0) throw new ApiError("Token expired", 401);
  const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity,
    name: member.name,
    ttl,
    metadata: JSON.stringify({
      roomId,
      participant: { name: member.name, email: member.email, role: member.role },
    }),
  });
  at.addGrant(participantGrants(roomId, member.role, webinar, member.microphoneAllowed));
  return at.toJwt();
}
