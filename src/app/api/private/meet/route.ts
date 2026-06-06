import { NextRequest } from "next/server";
import { createInstantMeet } from "@/app/backend/services/meet-services/create-instant-meet";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";

// GET /api/private/meet - Returns the public LiveKit server URL
export async function GET() {
  const serverUrl = process.env.LIVEKIT_URL;
  if (!serverUrl) {
    return ApiResponse.failure("LiveKit URL is not configured.", 500);
  }
  return ApiResponse.success({ serverUrl });
}

// POST /api/private/meet - Generates room and returns two tokens (Host and Participant)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, passcode } = body;
    if (!user) {
      throw new ApiError("User details are required", 400);
    }
    if (!user.userName || !user.role) {
      throw new ApiError("User userName and role are required", 400);
    }
    if (!passcode) {
      throw new ApiError("Passcode is required", 400);
    }
    // Call service to generate room code and save in MongoDB
    const meet = await createInstantMeet({
      user,
      passcode,
    });
    const roomName = meet.roomId;
    const origin = request.nextUrl.origin;
    // Provide clean joining links without pre-signed token hashes
    const hostLink = `${origin}/meet/${roomName}?userName=${user.userName}`;
    const participantLink = `${origin}/meet/${roomName}`;
    return ApiResponse.success(
      {
        roomName,
        hostLink,
        participantLink,
        meet,
      },
      "Meeting generated successfully",
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(
      err.message || "Failed to initialize meeting",
      500,
    );
  }
}
