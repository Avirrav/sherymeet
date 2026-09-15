import { z } from "zod";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { config } from "@/server/utils/config";
import { dbConnect } from "@/server/utils/db-connect";
import { getStore } from "@/server/utils/store";
import { logger } from "@/server/utils/logger";
import { RoomMember } from "@/server/models/room-member";
import { ConferenceRoomDao } from "@/server/dao/conferenceroom-dao";
import { ConferenceRoomType, StatusType } from "@/server/types/conferenceroom.types";
import { ParticipantRole } from "@/types/roles";
import { isAdminRole } from "@/server/services/livekit/participant-grants";
import { verifyRoomToken } from "@/server/services/livekit/verify-room-token";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { AuthenticatedRequest } from "@/server/types/auth.types";

const schema = z.object({ identity: z.string().min(1).max(256), onPanel: z.boolean() }).strict();

export async function panelHandler(request: AuthenticatedRequest) {
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
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError("Invalid panel request", 400);
    const { identity, onPanel } = parsed.data;
    target = identity;
    if (actor === identity) throw new ApiError("Cannot change your own panel role", 403);
    const limit = await getStore().checkRateLimit(`panel:${roomId}:${actor}`, 30, 60);
    if (!limit.allowed) throw new ApiError("Too many panel changes", 429);
    const room = await ConferenceRoomDao.getConferenceRoom({ roomId });
    if (!room || room.status !== StatusType.Active || room.type !== ConferenceRoomType.Webinar) {
      throw new ApiError("Panel controls require an active webinar", 409);
    }
    await dbConnect();
    const caller = await RoomMember.findOne({ roomId, identity: actor });
    if (!caller || !isAdminRole(caller.role))
      throw new ApiError("Current admin membership required; rejoin the room", 403);
    const member = await RoomMember.findOne({ roomId, identity });
    if (!member)
      throw new ApiError("Participant must rejoin before changing their panel role", 409);
    if (isAdminRole(member.role))
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
    const role = onPanel ? ParticipantRole.PANELIST : ParticipantRole.PARTICIPANT;
    const locked = await RoomMember.findOneAndUpdate(
      { roomId, identity, role: member.role, lockUntil: { $lte: new Date() } },
      { $set: { role, lockUntil } },
      { new: true },
    );
    if (!locked) throw new ApiError("Another panel change is in progress; retry shortly", 409);
    try {
      await service.updateParticipant(roomId, identity, {
        permission: {
          canPublish: onPanel,
          canSubscribe: true,
          canPublishData: true,
          canPublishSources: onPanel ? [TrackSource.MICROPHONE, TrackSource.CAMERA] : [],
          canUpdateMetadata: false,
        },
        metadata: JSON.stringify({
          roomId,
          participant: { name: member.name, email: member.email, role },
        }),
      });
    } catch {
      // Keep the desired role durable: a network timeout may occur AFTER LiveKit
      // applied the operation. Retrying the same action safely reconciles it.
      throw new ApiError(
        "Panel role saved, but live update failed. Retry this action to synchronize it.",
        502,
      );
    } finally {
      await RoomMember.updateOne(
        { roomId, identity, lockUntil },
        { $set: { lockUntil: new Date(0) } },
      );
    }
    logger.info("Panel role changed", { roomId, actor, target, role });
    return ApiResponse.success({ identity, role });
  } catch (error) {
    logger.warn("Panel change failed", {
      roomId,
      actor,
      target,
      status: error instanceof ApiError ? error.message : "LiveKit or database unavailable",
    });
    return ApiResponse.fromError(error, "Failed to change panel role");
  }
}
export const POST = runMiddlewares(
  [requestIdMiddleware, ipRateLimitMiddleware, serverApiMiddleware],
  panelHandler,
);
