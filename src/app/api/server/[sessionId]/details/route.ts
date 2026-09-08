import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { verifyRoomToken } from "@/server/services/livekit/verify-room-token";
import { getSessionDetails, toPublicMeetDetails } from "@/server/services/server/server.services";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { AuthenticatedRequest } from "@/server/types/auth.types";

function getRoomIdFromPath(request: AuthenticatedRequest): string | null {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  // .../api/server/[sessionId]/details — sessionId is second-to-last.
  return segments[segments.length - 2] || null;
}

/**
 * GET /api/server/[sessionId]/details
 * Returns the public meeting details. Requires a valid LiveKit room token for
 * that room in the Authorization header (Bearer) — possession of a signed
 * token is the credential, so meeting metadata is never exposed to callers
 * who were not invited.
 */
export async function getDetailsHandler(request: AuthenticatedRequest): Promise<Response> {
  try {
    const roomId = getRoomIdFromPath(request);
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

    const meet = await getSessionDetails({ roomId });
    return ApiResponse.success(toPublicMeetDetails(meet));
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to fetch meeting details");
  }
}

export const GET = runMiddlewares(
  [requestIdMiddleware, ipRateLimitMiddleware, serverApiMiddleware],
  getDetailsHandler,
);
