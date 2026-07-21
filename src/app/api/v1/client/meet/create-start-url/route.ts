import { generateToken } from "@/app/backend/services/media-server-services/generate-token";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";
import { IParticipant, ParticipantRole } from "@/app/backend/interfaces/user-interface";
import { MeetDao } from "@/app/backend/dao/meet-dao";
import bcrypt from "bcryptjs";
import { AuthenticatedRequest } from "@/app/backend/interfaces/auth-interface";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { requestIdMiddleware } from "@/app/backend/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/app/backend/middleware/authentication-middleware";
import { rateLimitMiddleware } from "@/app/backend/middleware/rate-limit-middleware";
import { authorizationMiddleware } from "@/app/backend/middleware/authorization-middleware";
import { auditMiddleware } from "@/app/backend/middleware/audit-middleware";
import { replayProtectionMiddleware } from "@/app/backend/middleware/replay-protection.middleware";

/**
 * POST /api/private/meet/join-as-host
 * Generates an Access Token for joining a specific room as a host, verifies role hierarchy,
 * triggers LiveKit room creation, and returns the signed token.
 */
export async function startMeetHandler(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { roomId, passcode } = body;
    const user = request.user;
    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }
    if (!user) {
      throw new ApiError("User details are required", 400);
    }
    if (!user.userName) {
      throw new ApiError("Host userName and role are required", 400);
    }
    // Fetch meeting details from database
    const meet = await MeetDao.getMeetByRoomId(roomId);
    if (!meet) {
      throw new ApiError("Meeting not found", 404);
    }
    // Check meeting status
    if (meet.status === "ended") {
      throw new ApiError("Meeting already ended", 400);
    }
    // Verify passcode if set
    if (meet.passcode) {
      if (!passcode) {
        throw new ApiError("Passcode is required to create the start url.", 400);
      }
      const isMatch = await bcrypt.compare(passcode, meet.passcode);
      if (!isMatch) {
        throw new ApiError("Invalid passcode", 401);
      }
    }
    // 1. Map the user to IParticipant structure
    const participant: IParticipant = {
      name: user.userName,
      role: ParticipantRole.HOST
    };
    // 2. Generate connection token (checks role internally for MENTOR / ADMIN grants)
    const token = await generateToken({
      roomName: roomId,
      participant,
    });
    if (!token) {
      throw new ApiError("Failed to generate token", 500);
    }
    // Activation (status -> active) and recording no longer happen here; the
    // host explicitly triggers both from the meet page via /start-meeting.

    const startUrl = `${process.env.NEXT_PUBLIC_API_URL}/meet/${roomId}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}&userName=${encodeURIComponent(user.userName)}`;
    return ApiResponse.success(
      {
        startUrl,
      },
      "Start URL Generated Successfully.",
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to join meeting", 500);
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
  startMeetHandler,
);
