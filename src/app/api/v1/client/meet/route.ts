import { createInstantMeet } from "@/app/backend/services/meet-services/create-instant-meet";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";
import { AuthenticatedRequest } from "@/app/backend/interfaces/auth-interface";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { requestIdMiddleware } from "@/app/backend/middleware/requestid-middleware";
import { rateLimitMiddleware } from "@/app/backend/middleware/rate-limit-middleware";
import { authenticationMiddleware } from "@/app/backend/middleware/authentication-middleware";
import { authorizationMiddleware } from "@/app/backend/middleware/authorization-middleware";

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
    const { host, passcode } = body;
    if (!host) {
      throw new ApiError("Host details are required", 400);
    }
    if (!host.userName || !host.role) {
      throw new ApiError("Host userName and role are required", 400);
    }
    if (!passcode) {
      throw new ApiError("Passcode is required", 400);
    }
    // Call service to generate room code and save in MongoDB
    const meet = await createInstantMeet({
      host,
      passcode,
    });
    const roomName = meet.roomId;
    const origin = request.nextUrl.origin;
    // Provide clean joining links without pre-signed token hashes
    const hostLink = `${origin}/meet/${roomName}?userName=${host.userName}`;
    const participantLink = `${origin}/meet/${roomName}`;
    return ApiResponse.success(
      {
        roomName,
        hostLink,
        participantLink,
        meet,
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
[requestIdMiddleware, 
  authenticationMiddleware, 
  authorizationMiddleware(["createMeeting"]),
  rateLimitMiddleware],
  createMeetHandler,
);
