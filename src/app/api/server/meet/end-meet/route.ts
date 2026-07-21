import { NextRequest } from "next/server";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";
import { endMeet } from "@/app/backend/services/meet-services/end-meet";
import { verifyRoomToken } from "@/app/backend/services/media-server-services/verify-room-token";
import { serverApiMiddleware } from "@/app/backend/middleware/server-api-middleware";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";

/**
 * POST /api/server/meet/end-meet
 * Re-verifies roomAdmin server-side (same as start-meeting) before ending
 * the meeting for everyone, stopping recordings, and deleting the room.
 */
export async function endMeetHandler(request: NextRequest) {
  try {
    const { roomId, token } = await request.json();
    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }
    if (!token) {
      throw new ApiError("Token is required", 400);
    }

    const { roomAdmin } = await verifyRoomToken(token, roomId);
    if (!roomAdmin) {
      throw new ApiError("Unauthorized: only the host can end the meeting", 403);
    }

    const updatedMeet = await endMeet({ roomId });
    return ApiResponse.success({ meet: updatedMeet });
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to end meeting", 500);
  }
}

export const POST = runMiddlewares([serverApiMiddleware], endMeetHandler);
