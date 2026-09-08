import bcrypt from "bcryptjs";
import { z } from "zod";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { verifyRoomToken } from "@/server/services/livekit/verify-room-token";
import { getSessionDetails, toPublicMeetDetails } from "@/server/services/server/server.services";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { validateBodyMiddleware } from "@/server/middleware/validate-body-middleware";
import { verifyTokenSchema } from "@/server/validator/server.validator";
import { AuthenticatedRequest } from "@/server/types/auth.types";

const bodySchema = verifyTokenSchema.extend({
  password: z.string().optional(),
});

/**
 * POST /api/server/[sessionId]/verify-token
 * Called by the meet page itself to confirm a room token is genuine before
 * rendering anything, and to report the native roomAdmin grant so the page
 * can decide between "no access", "show start meeting button", and "ready".
 */
export async function verifyTokenHandler(request: AuthenticatedRequest) {
  try {
    const { roomId, token, password } = request.validatedBody as z.infer<typeof bodySchema>;

    const { roomAdmin } = await verifyRoomToken(token, roomId);

    const meet = await getSessionDetails({ roomId });

    // The signed token is the actual credential here (the passcode was
    // already verified server-side when the token was issued). We only
    // re-check a passcode when one is explicitly supplied, and then it must
    // be correct.
    if (meet.passcode && password) {
      const isMatch = await bcrypt.compare(password, meet.passcode);
      if (!isMatch) {
        throw new ApiError("Invalid passcode", 401);
      }
    }

    return ApiResponse.success({
      valid: true,
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
  [
    requestIdMiddleware,
    ipRateLimitMiddleware,
    serverApiMiddleware,
    validateBodyMiddleware(bodySchema),
  ],
  verifyTokenHandler,
);
