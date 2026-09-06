import { z } from "zod";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { createWebinarSchema } from "@/server/validator/webinar.validator";
import { AuthenticatedRequest, IApiClient } from "@/server/types/auth.types";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { rateLimitMiddleware } from "@/server/middleware/rate-limit-middleware";
import { authenticationMiddleware } from "@/server/middleware/authentication-middleware";
import { auditMiddleware } from "@/server/middleware/audit-middleware";
import { replayProtectionMiddleware } from "@/server/middleware/replay-protection-middleware";
import { validateBodyMiddleware } from "@/server/middleware/validate-body-middleware";
import { createInstantWebinar } from "@/server/services/webinar/webinar.services";
import { IParticipant, ParticipantRole } from "@/types/roles";
import { generateToken } from "@/server/services/livekit/generate-token";
import { config } from "@/server/utils/config";

// POST /api/private/meet - Generates room and returns two tokens (Host and Participant)
export async function createWebinarHandler(request: AuthenticatedRequest) {
  try {
    const { passcode, isRecording } = request.validatedBody as z.infer<typeof createWebinarSchema>;
    const host = request.client as IApiClient;
    const canRecord = !!(isRecording && request.client?.allowRecording);
    // Call service to generate room code and save in MongoDB
    const webinar = await createInstantWebinar(passcode, canRecord);
    if (!webinar || !webinar.roomId) {
      throw new ApiError("Failed to create webinar", 500);
    }
    // 1. Map the host to IParticipant structure
    const participant: IParticipant = {
      name: host.name,
      role: ParticipantRole.HOST,
    };
    // 2. Generate connection token (checks role internally for MENTOR / ADMIN grants)
    const token = await generateToken({
      roomId: webinar.roomId,
      participant,
    });
    if (!token) {
      throw new ApiError("Failed to generate token", 500);
    }
    const startUrl = `${config.NEXT_PUBLIC_API_URL}/meet/${webinar.roomId}#token=${encodeURIComponent(token)}`;
    const registrationUrl = `${config.NEXT_PUBLIC_API_URL}/webinar/${webinar.roomId}/registrants`;
    // Provide clean joining links without pre-signed token hashes
    return ApiResponse.success(
      {
        webinarId: webinar.roomId,
        startUrl: startUrl,
        registrationUrl: registrationUrl,
      },
      "Webinar generated successfully",
    );
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to initialize webinar");
  }
}

export const POST = runMiddlewares(
  [
    requestIdMiddleware,
    auditMiddleware,
    authenticationMiddleware,
    validateBodyMiddleware(createWebinarSchema),
    rateLimitMiddleware,
    replayProtectionMiddleware,
  ],
  createWebinarHandler,
);
