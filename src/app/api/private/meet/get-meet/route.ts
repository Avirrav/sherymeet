import { NextRequest } from "next/server";
import { getMeetDetails } from "@/app/backend/services/meet-services/get-meet-details";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { requestIdMiddleware } from "@/app/backend/middleware/requestid-middleware";
import { authenticationMiddleware } from "@/app/backend/middleware/authentication-middleware";
import { authorizationMiddleware } from "@/app/backend/middleware/authorization-middleware";
import { rateLimitMiddleware } from "@/app/backend/middleware/rate-limit-middleware";

/**
 * GET /api/private/meet/get-meet?roomId=xyz
 * Returns the meeting details for the given roomId.
 */
export async function getMeetDetailsHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }

    const meet = await getMeetDetails({ roomId });

    return ApiResponse.success({ meet }, "Meeting details retrieved successfully.");
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to retrieve meeting", 500);
  }
}


export const GET = runMiddlewares(
  [
    requestIdMiddleware,
    authenticationMiddleware,
    authorizationMiddleware(["getMeeting"]),
    rateLimitMiddleware
  ],
  getMeetDetailsHandler
)


