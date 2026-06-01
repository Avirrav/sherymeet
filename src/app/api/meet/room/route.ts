import { NextRequest } from "next/server";
import { createRoom } from "@/app/backend/services/create-room";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";

// Helper to generate a format like abc-defg-hij
function generateRoomCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const part = (len: number) =>
    Array.from(
      { length: len },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  return `${part(3)}-${part(4)}-${part(3)}`;
}

// Create room API endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxParticipants } = body;
    const roomName = generateRoomCode();
    if (!roomName) {
      throw new ApiError("Failed to generate room code", 500);
    }
    if (!maxParticipants) {
      throw new ApiError("Max participants is required", 400);
    }
    if (maxParticipants > 5) {
      throw new ApiError("Max participants is greater than 5", 400);
    }
    // Call service layer to initialize room on Media server
    const room = await createRoom(roomName, maxParticipants);
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
