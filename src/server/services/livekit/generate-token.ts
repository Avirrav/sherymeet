import crypto from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { IParticipant, ParticipantRole } from "@/types/roles";
import { ConferenceRoomDao } from "@/server/dao/conferenceroom-dao";
import { config } from "@/server/utils/config";
import { ConferenceRoomType, StatusType } from "@/server/types/conferenceroom.types";
import { ApiError } from "@/server/utils/api-helper";
import { RoomMember } from "@/server/models/room-member";
import { dbConnect } from "@/server/utils/db-connect";
import { participantGrants, isAdminRole } from "./participant-grants";

export async function generateToken({
  roomId,
  participant,
}: {
  roomId: string;
  participant: IParticipant;
}): Promise<string> {
  const room = await ConferenceRoomDao.getConferenceRoom({ roomId });
  if (!room || room.status === StatusType.Ended) throw new ApiError("Meeting unavailable", 404);
  await dbConnect();
  const email = participant.email?.trim().toLowerCase();
  // Only trusted server callers mint identities. Reissues for the same email
  // retain the saved role instead of restoring obsolete audience permissions.
  const roleFilter = isAdminRole(participant.role)
    ? participant.role
    : { $in: [ParticipantRole.PARTICIPANT, ParticipantRole.PANELIST] };
  let member = email ? await RoomMember.findOne({ roomId, email, role: roleFilter }) : null;
  if (!member) {
    const scope = isAdminRole(participant.role) ? participant.role : "attendee";
    const identity = email
      ? crypto
          .createHmac("sha256", config.LIVEKIT_API_SECRET)
          .update(JSON.stringify([roomId, email, scope]))
          .digest("hex")
      : crypto.randomUUID();
    member = await RoomMember.findOneAndUpdate(
      { roomId, identity },
      {
        $setOnInsert: {
          roomId,
          identity,
          name: participant.name,
          email,
          role: participant.role,
        },
      },
      { upsert: true, new: true },
    );
  }
  if (!member) throw new ApiError("Could not create participant", 500);
  if (member.lockUntil > new Date())
    throw new ApiError("Permissions are changing; retry shortly", 409);
  const at = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
    identity: member.identity,
    metadata: JSON.stringify({
      participant: { name: member.name, email: member.email, role: member.role },
      roomId,
    }),
    name: member.name,
    ttl: config.LIVEKIT_TOKEN_TTL,
  });
  at.addGrant(participantGrants(roomId, member.role, room.type === ConferenceRoomType.Webinar));
  return at.toJwt();
}
