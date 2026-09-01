import { createInstantMeet } from "@/server/services/meet/create-instant-meet";
import { ApiResponse } from "@/server/utils/api-helper";
import { createMeetSchema, parseJsonBody } from "@/server/validation/meet-schemas";
import { AuthenticatedRequest } from "@/server/types/auth.types";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { rateLimitMiddleware } from "@/server/middleware/rate-limit-middleware";
import { authenticationMiddleware } from "@/server/middleware/authentication-middleware";
import { auditMiddleware } from "@/server/middleware/audit-middleware";
import { replayProtectionMiddleware } from "@/server/middleware/replay-protection-middleware";
import { config } from "@/server/utils/config";

// GET /api/private/meet - Returns the public LiveKit server URL
export async function GET() {
  const serverUrl = config.LIVEKIT_URL;
  if (!serverUrl) {
    return ApiResponse.failure("LiveKit URL is not configured.", 500);
  }
  return ApiResponse.success({ serverUrl });
}

// POST /api/private/meet - Generates room and returns two tokens (Host and Participant)
export async function createMeetHandler(request: AuthenticatedRequest) {
  try {
    const { passcode, type, isRecording } = await parseJsonBody(request, createMeetSchema);
    // Recording is only honored when the requesting API client is permitted
    // to use it; otherwise it's silently disabled rather than rejected.
    const canRecord = !!isRecording && !!request.client?.allowRecording;
    // Call service to generate room code and save in MongoDB
    const meet = await createInstantMeet({
      passcode,
      type,
      isRecording: canRecord,
    });
    const roomName = meet.roomId;
    // Provide clean joining links without pre-signed token hashes
    return ApiResponse.success(
      {
        roomName,
      },
      "Meeting generated successfully",
    );
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to initialize meeting");
  }
}

export const POST = runMiddlewares(
  [
    requestIdMiddleware,
    auditMiddleware,
    authenticationMiddleware,
    rateLimitMiddleware,
    replayProtectionMiddleware,
  ],
  createMeetHandler,
);
