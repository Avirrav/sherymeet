import { NextRequest } from "next/server";
import { endMeet } from "@/server/services/meet/end-meet";
import { ApiResponse } from "@/server/utils/api-helper";
import { endMeetSchema, parseJsonBody } from "@/server/validation/meet-schemas";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/server/middleware/authentication-middleware";
import { rateLimitMiddleware } from "@/server/middleware/rate-limit-middleware";
import { replayProtectionMiddleware } from "@/server/middleware/replay-protection-middleware";
import { auditMiddleware } from "@/server/middleware/audit-middleware";

/**
 * POST /api/private/meet/end-meet
 * Ends a meeting: updates status in DB, stops recording, and deletes room in LiveKit.
 */
export async function endMeetHandler(request: NextRequest) {
  try {
    const { roomId } = await parseJsonBody(request, endMeetSchema);

    const meet = await endMeet({ roomId });

    return ApiResponse.success({ meet }, "Meeting ended successfully.");
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to end meeting");
  }
}
export const POST = runMiddlewares(
  [
    requestIdMiddleware,
    auditMiddleware,
    authenticationMiddleware,
    rateLimitMiddleware,
    replayProtectionMiddleware
  ],
  endMeetHandler,
);
