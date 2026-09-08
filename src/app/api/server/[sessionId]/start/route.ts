import { z } from "zod";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { verifyRoomToken } from "@/server/services/livekit/verify-room-token";
import { startSession } from "@/server/services/server/server.services";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { validateBodyMiddleware } from "@/server/middleware/validate-body-middleware";
import { startSessionSchema } from "@/server/validator/server.validator";
import { AuthenticatedRequest } from "@/server/types/auth.types";

/**
 * POST /api/server/[sessionId]/start
 * Called when the host clicks "Start Meeting". Re-verifies roomAdmin
 * server-side, creates the LiveKit room, flips the room to active, and
 * (only if it was created with recording enabled) starts Egress. Idempotent.
 */
export async function startMeetingHandler(request: AuthenticatedRequest) {
  try {
    const { roomId, token } = request.validatedBody as z.infer<typeof startSessionSchema>;

    const { roomAdmin } = await verifyRoomToken(token, roomId);
    if (!roomAdmin) {
      throw new ApiError("Unauthorized: only the host can start the meeting", 403);
    }

    const startedConferenceRoom = await startSession({ roomId });
    return ApiResponse.success({
      status: startedConferenceRoom.status,
      isRecording: startedConferenceRoom.isRecording,
    });
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to start meeting");
  }
}

export const POST = runMiddlewares(
  [
    requestIdMiddleware,
    ipRateLimitMiddleware,
    serverApiMiddleware,
    validateBodyMiddleware(startSessionSchema),
  ],
  startMeetingHandler,
);
