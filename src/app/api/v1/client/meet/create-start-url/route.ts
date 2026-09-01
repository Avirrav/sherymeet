import { generateToken } from "@/server/services/media/generate-token";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { IParticipant, ParticipantRole } from "@/types/roles";
import { MeetDao } from "@/server/dao/meet-dao";
import bcrypt from "bcryptjs";
import { AuthenticatedRequest } from "@/server/types/auth.types";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/server/middleware/authentication-middleware";
import { rateLimitMiddleware } from "@/server/middleware/rate-limit-middleware";
import { authorizationMiddleware } from "@/server/middleware/authorization-middleware";
import { auditMiddleware } from "@/server/middleware/audit-middleware";
import { replayProtectionMiddleware } from "@/server/middleware/replay-protection-middleware";
import { createStartUrlSchema, parseJsonBody } from "@/server/validation/meet-schemas";
import { config } from "@/server/utils/config";

/**
 * POST /api/private/meet/join-as-host
 * Generates an Access Token for joining a specific room as a host, verifies role hierarchy,
 * triggers LiveKit room creation, and returns the signed token.
 */
export async function startMeetHandler(request: AuthenticatedRequest) {
  try {
    const { roomId, passcode } = await parseJsonBody(request, createStartUrlSchema);
    const user = request.user;
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

    // Token travels in the hash fragment so it never reaches server logs,
    // proxies, or Referer headers. The meet page reads the fragment client-side.
    const startUrl = `${config.NEXT_PUBLIC_API_URL}/meet/${roomId}#token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}&userName=${encodeURIComponent(user.userName)}`;
    return ApiResponse.success(
      {
        startUrl,
      },
      "Start URL Generated Successfully.",
    );
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to create start URL");
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
