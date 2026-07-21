import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";
import { MeetDao } from "@/app/backend/dao/meet-dao";
import { verifyRoomToken } from "@/app/backend/services/media-server-services/verify-room-token";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { serverApiMiddleware } from "@/app/backend/middleware/server-api-middleware";

/**
 * POST /api/server/meet/verify-token
 * Called by the meet page itself to confirm a room token is genuine before
 * rendering anything, and to report the native roomAdmin grant so the page
 * can decide between "no access", "show start meeting button", and "ready".
 */
export async function verifyTokenHandler(request: NextRequest) {
  try {
    const { roomId, token, password } = await request.json();
    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }
    if (!token) {
      throw new ApiError("Token is required", 400);
    }

    const { participant, roomAdmin } = await verifyRoomToken(token, roomId);
    if (!participant?.role) {
      throw new ApiError("Token is missing participant metadata", 401);
    }

    const meet = await MeetDao.getMeetByRoomId(roomId);
    if (!meet) {
      throw new ApiError("Meeting not found", 404);
    }

    if (meet.passcode && password) {
      const isMatch = await bcrypt.compare(password, meet.passcode);
      if (!isMatch) {
        throw new ApiError("Invalid passcode", 401);
      }
    }

    return ApiResponse.success({
      valid: true,
      role: participant.role,
      roomAdmin,
      meetStatus: meet.status,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to verify token", 500);
  }
}

export const POST = runMiddlewares([serverApiMiddleware], verifyTokenHandler);
