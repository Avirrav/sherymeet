import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { generateToken } from "@/server/services/media-server-services/generate-token";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { IParticipant, ParticipantRole } from "@/server/interfaces/user-interface";
import { MeetDao } from "@/server/dao/meet-dao";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/server/middleware/authentication-middleware";
import { authorizationMiddleware } from "@/server/middleware/authorization-middleware";
import { rateLimitMiddleware } from "@/server/middleware/rate-limit-middleware";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { replayProtectionMiddleware } from "@/server/middleware/replay-protection.middleware";
import { auditMiddleware } from "@/server/middleware/audit-middleware";
import { joinAsUserSchema, parseJsonBody } from "@/server/validation/meet-schemas";

/**
 * POST /api/v1/client/meet/join-as-user
 * Generates an Access Token for joining a specific room as a participant and
 * returns the join link. Validates that the meeting exists, has not ended,
 * and (when the meeting has a passcode) that the correct passcode was sent.
 */
export async function joinAsUserHandler(request: NextRequest) {
  try {
    const { roomId, passcode, participantData } = await parseJsonBody(request, joinAsUserSchema);

    const meet = await MeetDao.getMeetByRoomId(roomId);
    if (!meet) {
      throw new ApiError("Meeting not found", 404);
    }
    if (meet.status === "ended") {
      throw new ApiError("Meeting already ended", 400);
    }
    if (meet.passcode) {
      if (!passcode) {
        throw new ApiError("Passcode is required to join this meeting", 400);
      }
      const isMatch = await bcrypt.compare(passcode, meet.passcode);
      if (!isMatch) {
        throw new ApiError("Invalid passcode", 401);
      }
    }

    const participant: IParticipant = {
      // Older clients send `username`; the documented field is `name`.
      name: (participantData.name || participantData.username) as string,
      role: ParticipantRole.PARTICIPANT,
    };
    const token = await generateToken({
      roomName: roomId,
      participant,
    });
    if (!token) {
      throw new ApiError("Failed to generate token", 500);
    }
    // Token travels in the hash fragment so it never reaches server logs,
    // proxies, or Referer headers. The meet page reads the fragment client-side.
    const meetLink = `${process.env.NEXT_PUBLIC_API_URL}/meet/${roomId}#token=${encodeURIComponent(token)}&userName=${encodeURIComponent(participant.name)}`;
    return ApiResponse.success(
      {
        roomId,
        meetLink,
      },
      "Joined meeting successfully.",
    );
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to join meeting");
  }
}
export const POST = runMiddlewares(
  [
    requestIdMiddleware,
    auditMiddleware,
    authenticationMiddleware,
    authorizationMiddleware(["createParticipantJoinUrl"]),
    rateLimitMiddleware,
    replayProtectionMiddleware,
  ],
  joinAsUserHandler,
);
