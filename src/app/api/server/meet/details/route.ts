import { NextRequest } from "next/server";
import { getMeetDetails } from "@/app/backend/services/meet-services/get-meet-details";
import { ApiResponse, ApiError } from "@/app/backend/utils/api-helper";
import { verifyRoomToken } from "@/app/backend/services/media-server-services/verify-room-token";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { serverApiMiddleware } from "@/app/backend/middleware/server-api-middleware";
import { requestIdMiddleware } from "@/app/backend/middleware/requestid-middleware";
import { ipRateLimitMiddleware } from "@/app/backend/middleware/ip-rate-limit-middleware";

/**
 * GET /api/server/meet/details?roomId=...
 * Returns the public meeting details. Requires a valid LiveKit room token for
 * that room in the Authorization header (Bearer) — possession of a signed
 * token is the credential, so meeting metadata is never exposed to callers
 * who were not invited.
 */
export async function getDetailsHandler(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      throw new ApiError("Unauthorized: room token is required", 401);
    }
    // Throws 401 on an invalid/expired token or a token for another room.
    await verifyRoomToken(token, roomId);

    const meet = await getMeetDetails({ roomId });
    return ApiResponse.success(meet);
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to fetch meeting details");
  }
}

export const GET = runMiddlewares(
  [requestIdMiddleware, ipRateLimitMiddleware, serverApiMiddleware],
  getDetailsHandler
);
