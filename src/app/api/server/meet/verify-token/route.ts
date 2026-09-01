import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { MeetDao } from "@/server/dao/meet-dao";
import { verifyRoomToken } from "@/server/services/media/verify-room-token";
import { toPublicMeetDetails } from "@/server/services/meet/get-meet-details";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { parseJsonBody, verifyTokenSchema } from "@/server/validation/meet-schemas";

/**
 * POST /api/server/meet/verify-token
 * Called by the meet page itself to confirm a room token is genuine before
 * rendering anything, and to report the native roomAdmin grant so the page
 * can decide between "no access", "show start meeting button", and "ready".
 */
export async function verifyTokenHandler(request: NextRequest) {
  try {
    const { roomId, token, password } = await parseJsonBody(request, verifyTokenSchema);

    const { participant, roomAdmin } = await verifyRoomToken(token, roomId);
    if (!participant?.role) {
      throw new ApiError("Token is missing participant metadata", 401);
    }

    const meet = await MeetDao.getMeetByRoomId(roomId);
    if (!meet) {
      throw new ApiError("Meeting not found", 404);
    }

    // The signed token is the actual credential here (the passcode was already
    // verified server-side when the token was issued). We only re-check a
    // passcode when one is explicitly supplied, and then it must be correct.
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
      // Full public details so the page doesn't need a second round-trip.
      meet: toPublicMeetDetails(meet),
    });
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to verify token");
  }
}

export const POST = runMiddlewares(
  [requestIdMiddleware, ipRateLimitMiddleware, serverApiMiddleware],
  verifyTokenHandler,
);
