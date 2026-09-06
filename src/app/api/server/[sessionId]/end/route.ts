import { z } from "zod";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { verifyRoomToken } from "@/server/services/livekit/verify-room-token";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { validateBodyMiddleware } from "@/server/middleware/validate-body-middleware";
import { endSessionSchema } from "@/server/validator/server.validator";
import { AuthenticatedRequest } from "@/server/types/auth.types";
import { endSession } from "@/server/services/server/server.services";

export async function endMeetHandler(request: AuthenticatedRequest) {
  try {
    const { roomId, token } = request.validatedBody as z.infer<typeof endSessionSchema>;
    const { roomAdmin } = await verifyRoomToken(token, roomId);
    if (!roomAdmin) {
      throw new ApiError("Unauthorized: only the host can end the meeting", 403);
    }
    const updatedMeet = await endSession({ roomId });
    return ApiResponse.success({ meet: updatedMeet });
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to end meeting");
  }
}

export const POST = runMiddlewares(
  [
    requestIdMiddleware,
    ipRateLimitMiddleware,
    serverApiMiddleware,
    validateBodyMiddleware(endSessionSchema),
  ],
  endMeetHandler,
);
