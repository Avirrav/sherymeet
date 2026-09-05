import { NextRequest } from "next/server";
import { generateToken } from "@/server/services/media/generate-token";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { IParticipant, ParticipantRole } from "@/types/roles";
import { MeetDao } from "@/server/dao/meet-dao";
import bcrypt from "bcryptjs";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/server/middleware/authentication-middleware";
import { rateLimitMiddleware } from "@/server/middleware/rate-limit-middleware";
import { auditMiddleware } from "@/server/middleware/audit-middleware";
import { replayProtectionMiddleware } from "@/server/middleware/replay-protection-middleware";
import { createStartUrlSchema, parseJsonBody } from "@/server/validation/meet-schemas";
import { config } from "@/server/utils/config";

export async function startWebinarHandler(request: NextRequest) {
  try {
    const { roomId, passcode, host } = await parseJsonBody(request, createStartUrlSchema);
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
    // 1. Map the host to IParticipant structure
    const participant: IParticipant = {
      name: host.userName,
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
    const startUrl = `${config.NEXT_PUBLIC_API_URL}/meet/${roomId}#token=${encodeURIComponent(token)}&email=${encodeURIComponent(host.email)}&userName=${encodeURIComponent(host.userName)}`;
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
    

    rateLimitMiddleware,
    replayProtectionMiddleware,
  ],
  startWebinarHandler,
);
