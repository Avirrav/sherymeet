import { NextRequest } from "next/server";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { endMeet } from "@/server/services/meet/end-meet";
import { verifyRoomToken } from "@/server/services/media/verify-room-token";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { parseJsonBody, serverRoomTokenSchema } from "@/server/validation/meet-schemas";

/**
 * POST /api/server/meet/end-meet
 * Re-verifies roomAdmin server-side (same as start-meeting) before ending
 * the meeting for everyone, stopping recordings, and deleting the room.
 */
export async function endMeetHandler(request: NextRequest) {
  try {
    const { roomId, token } = await parseJsonBody(request, serverRoomTokenSchema);

    const { roomAdmin } = await verifyRoomToken(token, roomId);
    if (!roomAdmin) {
      throw new ApiError("Unauthorized: only the host can end the meeting", 403);
    }

    const updatedMeet = await endMeet({ roomId });
    return ApiResponse.success({ meet: updatedMeet });
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to end meeting");
  }
}

export const POST = runMiddlewares(
  [requestIdMiddleware, ipRateLimitMiddleware, serverApiMiddleware],
  endMeetHandler,
);
