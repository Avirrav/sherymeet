import { NextRequest } from "next/server";
import { endMeet } from "@/app/backend/services/meet-services/end-meet";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";

/**
 * POST /api/private/meet/end-meet
 * Ends a meeting: updates status in DB, stops recording, and deletes room in LiveKit.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId } = body;

    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }

    const meet = await endMeet({ roomId });

    return ApiResponse.success({ meet }, "Meeting ended successfully.");
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to end meeting", 500);
  }
}
