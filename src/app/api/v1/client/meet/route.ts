import { createInstantMeet } from "@/app/backend/services/meet-services/create-instant-meet";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";
import { AuthenticatedRequest } from "@/app/backend/interfaces/auth-interface";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { requestIdMiddleware } from "@/app/backend/middleware/requestid-middleware";
import { rateLimitMiddleware } from "@/app/backend/middleware/rate-limit-middleware";
import { authenticationMiddleware } from "@/app/backend/middleware/authentication-middleware";
import { authorizationMiddleware } from "@/app/backend/middleware/authorization-middleware";
import { auditMiddleware } from "@/app/backend/middleware/audit-middleware";
import { replayProtectionMiddleware } from "@/app/backend/middleware/replay-protection.middleware";

// GET /api/private/meet - Returns the public LiveKit server URL
export async function GET() {
  const serverUrl = process.env.LIVEKIT_URL;
  if (!serverUrl) {
    return ApiResponse.failure("LiveKit URL is not configured.", 500);
  }
  return ApiResponse.success({ serverUrl });
}

// POST /api/private/meet - Generates room and returns two tokens (Host and Participant)
export async function createMeetHandler(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { passcode, type, isRecording } = body;
    if (!passcode) {
      throw new ApiError("Passcode is required", 400);
    }
    if (type && type !== "webinar" && type !== "meet") {
      throw new ApiError("Type must be either 'webinar' or 'meet'", 400);
    }
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
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(
      err.message || "Failed to initialize meeting",
      500,
    );
  }
}

export const POST = runMiddlewares(
  [
    requestIdMiddleware,
    auditMiddleware,
    authenticationMiddleware,
    authorizationMiddleware(["createMeeting"]),
    rateLimitMiddleware,
    replayProtectionMiddleware,
  ],
  createMeetHandler,
);
