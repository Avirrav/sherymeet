import { z } from "zod";
import { RoomServiceClient } from "livekit-server-sdk";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { config } from "@/server/utils/config";
import { dbConnect } from "@/server/utils/db-connect";
import { getStore } from "@/server/utils/store";
import { logger } from "@/server/utils/logger";
import { RoomMember } from "@/server/models/room-member";
import { ConferenceRoomDao } from "@/server/dao/conferenceroom-dao";
import { ConferenceRoomType, StatusType } from "@/server/types/conferenceroom.types";
import { ParticipantRole } from "@/types/roles";
import { isAdminRole, participantPermissions } from "@/server/services/livekit/participant-grants";
import { verifyRoomToken } from "@/server/services/livekit/verify-room-token";
import { AuthenticatedRequest } from "@/server/types/auth.types";

const identitySchema = z.string().min(1).max(256);
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("panel"), identity: identitySchema, onPanel: z.boolean() }).strict(),
  z.object({ kind: z.literal("microphone"), identity: identitySchema }).strict(),
]);

export async function updateParticipantAccess(
  request: AuthenticatedRequest,
  kind: "panel" | "microphone",
) {
  let actor = "";
  let target = "";
  let roomId = "";
  try {
    roomId = request.nextUrl.pathname.split("/")[3] || "";
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) throw new ApiError("Room token required", 401);
    const verified = await verifyRoomToken(token, roomId);
    actor = verified.identity;
    if (!verified.roomAdmin) throw new ApiError("Room admin permission required", 403);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) || "kind" in body)
      throw new ApiError("Invalid permission request", 400);
    const parsed = schema.safeParse({ ...body, kind });
    if (!parsed.success) throw new ApiError("Invalid permission request", 400);
    const { identity } = parsed.data;
    target = identity;
    if (actor === identity) throw new ApiError("Cannot change your own permissions", 403);
    const limit = await getStore().checkRateLimit(`participant-access:${roomId}:${actor}`, 30, 60);
    if (!limit.allowed) throw new ApiError("Too many permission changes", 429);
    const room = await ConferenceRoomDao.getConferenceRoom({ roomId });
    if (
      !room ||
      room.status !== StatusType.Active ||
      (kind === "panel" && room.type !== ConferenceRoomType.Webinar)
    ) {
      throw new ApiError(
        "Permission controls require an active meeting; panel controls require a webinar",
        409,
      );
    }
    await dbConnect();
    const caller = await RoomMember.findOne({ roomId, identity: actor });
    if (!caller || !isAdminRole(caller.role))
      throw new ApiError("Current admin membership required; rejoin the room", 403);
    const member = await RoomMember.findOne({ roomId, identity });
    if (!member)
      throw new ApiError("Participant must rejoin before changing their permissions", 409);
    if (kind === "panel" && isAdminRole(member.role))
      throw new ApiError("Cannot change an admin's role with panel controls", 403);
    const service = new RoomServiceClient(
      config.LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:"),
      config.LIVEKIT_API_KEY,
      config.LIVEKIT_API_SECRET,
      { requestTimeout: 10 },
    );
    // Both identities must still be connected to this room.
    await service.getParticipant(roomId, actor);
    await service.getParticipant(roomId, identity);
    const lockUntil = new Date(Date.now() + 60000);
    const role =
      parsed.data.kind === "panel"
        ? parsed.data.onPanel
          ? ParticipantRole.PANELIST
          : ParticipantRole.PARTICIPANT
        : member.role;
    const locked = await RoomMember.findOneAndUpdate(
      { roomId, identity, role: member.role, lockUntil: { $lte: new Date() } },
      {
        $set: kind === "microphone" ? { microphoneAllowed: true, lockUntil } : { role, lockUntil },
      },
      { new: true },
    );
    if (!locked) throw new ApiError("Another permission change is in progress; retry shortly", 409);
    const microphoneAllowed = locked.microphoneAllowed === true;
    try {
      await service.updateParticipant(roomId, identity, {
        permission: participantPermissions(
          role,
          room.type === ConferenceRoomType.Webinar,
          microphoneAllowed,
        ),
        metadata: JSON.stringify({
          roomId,
          participant: { name: member.name, email: member.email, role },
        }),
      });
    } catch {
      // Keep the desired role durable: a network timeout may occur AFTER LiveKit
      // applied the operation. Retrying the same action safely reconciles it.
      throw new ApiError(
        "Permissions saved, but live update failed. Retry this action to synchronize them.",
        502,
      );
    } finally {
      await RoomMember.updateOne(
        { roomId, identity, lockUntil },
        { $set: { lockUntil: new Date(0) } },
      );
    }
    logger.info("Participant permissions changed", {
      roomId,
      actor,
      target,
      role,
      microphoneAllowed,
      kind,
    });
    return ApiResponse.success({ identity, role, microphoneAllowed });
  } catch (error) {
    logger.warn("Participant permission change failed", {
      roomId,
      actor,
      target,
      status: error instanceof ApiError ? error.message : "LiveKit or database unavailable",
    });
    return ApiResponse.fromError(error, "Failed to change participant permissions");
  }
}
