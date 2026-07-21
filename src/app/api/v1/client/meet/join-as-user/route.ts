import { NextRequest } from "next/server";
import { generateToken } from "@/app/backend/services/media-server-services/generate-token";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";
import { IParticipant, ParticipantRole } from "@/app/backend/interfaces/user-interface";
import { requestIdMiddleware } from "@/app/backend/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/app/backend/middleware/authentication-middleware";
import { authorizationMiddleware } from "@/app/backend/middleware/authorization-middleware";
import { rateLimitMiddleware } from "@/app/backend/middleware/rate-limit-middleware";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { replayProtectionMiddleware } from "@/app/backend/middleware/replay-protection.middleware";
import { auditMiddleware } from "@/app/backend/middleware/audit-middleware";

/**
 * POST /api/private/meet/join-as-user
 * Generates an Access Token for joining a specific active room as a user and returns the join link.
 */
export async function joinAsUserHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, participantData } = body;
    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }
    if (!participantData) {
      throw new ApiError("Participant details are required", 400);
    }
    if (!participantData.name || !participantData.role) {
      throw new ApiError("Participant name and role are required", 400);
    }
    // 1. Map the user to IParticipant structure
    const participant: IParticipant = {
      name: participantData.username,
      role: ParticipantRole.PARTICIPANT
    };
    // 2. Generate connection token
    const token = await generateToken({
      roomName: roomId,
      participant,
    });
    if (!token) {
      throw new ApiError("Failed to generate token", 500);
    }
    const serverUrl = process.env.LIVEKIT_URL;
    if (!serverUrl) {
      throw new ApiError("LiveKit server URL is not configured", 500);
    }
    const meetLink = `${process.env.NEXT_PUBLIC_API_URL}/meet/${roomId}?token=${token}`;
    return ApiResponse.success(
      {
        roomId,
        meetLink,
      },
      "Joined meeting successfully.",
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to join meeting", 500);
  }
}
export const POST =runMiddlewares(
    [
      requestIdMiddleware,
      auditMiddleware,
      authenticationMiddleware,
      authorizationMiddleware(["joinMeeting"]),
      rateLimitMiddleware,
      replayProtectionMiddleware,
    ],
    joinAsUserHandler,
  );

