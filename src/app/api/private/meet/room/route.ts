import { NextRequest } from "next/server";
import { createRoom } from "@/app/backend/services/media-server-services/create-room";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";

// Create room API endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxParticipants } = body;

    if (!maxParticipants) {
      throw new ApiError("Max participants is required", 400);
    }
    if (maxParticipants > 5) {
      throw new ApiError("Max participants is greater than 5", 400);
    }
    // Call service layer to initialize room on Media server
    const room = await createRoom(maxParticipants);
    if (!room.name) {
      throw new ApiError("Failed to create room", 500);
    }
    return ApiResponse.success({
      roomName: room.name,
      sid: room.sid,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Room creation failed", 500);
  }
}
