import { z } from "zod";
import { RoomServiceClient } from "livekit-server-sdk";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { config } from "@/server/utils/config";
import { dbConnect } from "@/server/utils/db-connect";
import { getStore } from "@/server/utils/store";
import { RoomMember } from "@/server/models/room-member";
import { ConferenceRoomDao } from "@/server/dao/conferenceroom-dao";
import { StatusType } from "@/server/types/conferenceroom.types";
import { ParticipantRole } from "@/types/roles";
import { verifyRoomToken } from "@/server/services/livekit/verify-room-token";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { AuthenticatedRequest } from "@/server/types/auth.types";

const schema = z.object({ seconds: z.number().int().min(0).max(300) }).strict();

export async function chatSlowModeHandler(request: AuthenticatedRequest) {
  try {
    const roomId = request.nextUrl.pathname.split("/")[3] || "";
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) throw new ApiError("Room token required", 401);
    const verified = await verifyRoomToken(token, roomId);
    if (!verified.roomAdmin) throw new ApiError("Host permission required", 403);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError("Slow mode seconds must be from 0 to 300", 400);
    await dbConnect();
    const caller = await RoomMember.findOne({ roomId, identity: verified.identity });
    if (caller?.role !== ParticipantRole.HOST)
      throw new ApiError("Only the host can change slow mode", 403);
    const meeting = await ConferenceRoomDao.getConferenceRoom({ roomId });
    if (!meeting || meeting.status !== StatusType.Active)
      throw new ApiError("Meeting is not active", 409);
    const limit = await getStore().checkRateLimit(
      `chat-slow-mode:${roomId}:${verified.identity}`,
      20,
      60,
    );
    if (!limit.allowed) throw new ApiError("Too many slow mode changes", 429);
    const service = new RoomServiceClient(
      config.LIVEKIT_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:"),
      config.LIVEKIT_API_KEY,
      config.LIVEKIT_API_SECRET,
      { requestTimeout: 10 },
    );
    await service.getParticipant(roomId, verified.identity);
    const [room] = await service.listRooms([roomId]);
    if (!room) throw new ApiError("Live room not found", 404);
    let metadata: Record<string, unknown> = {};
    if (room.metadata) {
      try {
        metadata = JSON.parse(room.metadata);
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error();
      } catch {
        throw new ApiError("Room metadata is invalid; slow mode was not changed", 409);
      }
    }
    await service.updateRoomMetadata(
      roomId,
      JSON.stringify({ ...metadata, chatSlowModeSeconds: parsed.data.seconds }),
    );
    return ApiResponse.success(parsed.data);
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to change slow mode");
  }
}

export const POST = runMiddlewares(
  [requestIdMiddleware, ipRateLimitMiddleware, serverApiMiddleware],
  chatSlowModeHandler,
);
