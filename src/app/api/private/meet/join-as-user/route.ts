import { NextRequest } from "next/server";
import { generateToken } from "@/app/backend/services/media-server-services/generate-token";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";
import { IParticipant } from "@/app/backend/interfaces/user-interface";
import { getMeetDetails } from "@/app/backend/services/meet-services/get-meet-details";

/**
 * POST /api/private/meet/join-as-user
 * Generates an Access Token for joining a specific active room as a user and returns the join link.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, user } = body;

    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }
    if (!user) {
      throw new ApiError("User details are required", 400);
    }
    if (!user.userName || !user.role) {
      throw new ApiError("User userName and role are required", 400);
    }
    // Fetch meeting details using the getMeetDetails service
    const meet = await getMeetDetails({ roomId });
    // Check meeting status: if meeting status is not active return error "Meeting is not started"
    if (meet.status !== "active") {
      throw new ApiError("Meeting is not started", 400);
    }

    // 1. Map the user to IParticipant structure
    const participant: IParticipant = {
      participantName: user.userName,
      role: user.role,
    };

    // 2. Generate connection token
    const token = await generateToken({
      roomName: roomId,
      user,
      participant,
    });
    if (!token) {
      throw new ApiError("Failed to generate token", 500);
    }

    const serverUrl = process.env.LIVEKIT_URL;
    if (!serverUrl) {
      throw new ApiError("LiveKit server URL is not configured", 500);
    }

    const meetLink = `${process.env.NEXT_PUBLIC_LIVEKIT_URL}/meet/${roomId}`;

    return ApiResponse.success(
      {
        token,
        roomId,
        serverUrl,
        meetLink,
      },
      "Joined meeting successfully.",
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to join meeting", 500);
  }
}

