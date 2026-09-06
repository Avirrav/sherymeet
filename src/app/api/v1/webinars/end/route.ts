import { z } from "zod";
import { endWebinar } from "@/server/services/webinar/webinar.services";
import { ApiResponse } from "@/server/utils/api-helper";
import { endWebinarSchema } from "@/server/validator/webinar.validator";
import { AuthenticatedRequest } from "@/server/types/auth.types";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/server/middleware/authentication-middleware";
import { rateLimitMiddleware } from "@/server/middleware/rate-limit-middleware";
import { replayProtectionMiddleware } from "@/server/middleware/replay-protection-middleware";
import { auditMiddleware } from "@/server/middleware/audit-middleware";
import { validateBodyMiddleware } from "@/server/middleware/validate-body-middleware";

export async function endWebinarHandler(request: AuthenticatedRequest) {
  try {
    const { roomId } = request.validatedBody as z.infer<typeof endWebinarSchema>;
    const meet = await endWebinar({ roomId: roomId });
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
    validateBodyMiddleware(endWebinarSchema),
    rateLimitMiddleware,
    replayProtectionMiddleware,
  ],
  endWebinarHandler,
);
