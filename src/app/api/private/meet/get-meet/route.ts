import { NextRequest } from "next/server";
import { getMeetDetails } from "@/app/backend/services/meet-services/get-meet-details";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";

/**
 * GET /api/private/meet/get-meet?roomId=xyz
 * Returns the meeting details for the given roomId.
 */
export async function GET(request: NextRequest) {
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
