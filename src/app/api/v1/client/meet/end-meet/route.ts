import { NextRequest } from "next/server";
import { endMeet } from "@/app/backend/services/meet-services/end-meet";
import { ApiResponse } from "@/app/backend/utils/api-helper";
import { endMeetSchema, parseJsonBody } from "@/app/backend/validation/meet-schemas";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { requestIdMiddleware } from "@/app/backend/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/app/backend/middleware/authentication-middleware";
import { authorizationMiddleware } from "@/app/backend/middleware/authorization-middleware";
import { rateLimitMiddleware } from "@/app/backend/middleware/rate-limit-middleware";
import { replayProtectionMiddleware } from "@/app/backend/middleware/replay-protection.middleware";
import { auditMiddleware } from "@/app/backend/middleware/audit-middleware";

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
    authorizationMiddleware(["endMeeting"]),
    rateLimitMiddleware,
    replayProtectionMiddleware
  ],
  endMeetHandler,
);
