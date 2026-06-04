import { NextRequest } from "next/server";
import { createRoom } from "@/app/backend/services/create-room";
import { generateToken } from "@/app/backend/services/generate-token";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";

// GET /api/private/meet - Returns the public LiveKit server URL
export async function GET() {
  const serverUrl = process.env.LIVEKIT_URL;
  if (!serverUrl) {
    return ApiResponse.failure("LiveKit URL is not configured on the server", 500);
  }
  return ApiResponse.success({ serverUrl });
}

// POST /api/private/meet - Generates room and returns two tokens (Host and Participant)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user, participant, maxParticipants} = body;    

    if (!user) {
      throw new ApiError("User details are required", 400);
    }
    if (!user.userName || !user.role) {
      throw new ApiError("User userName and role are required", 400);
    }

    // 1. Create the room on LiveKit
    const room = await createRoom(maxParticipants || 5);
    const roomName = room.name;
    if (!roomName) {
      throw new ApiError("Failed to create room", 500);
    }

    // 2. Generate Host Token
    const hostParticipant = {
      participantName: user.userName,
      role: user.role,
    };
    const hostToken = await generateToken({
      roomName,
      user,
      participant: hostParticipant,
    });
    if(!hostToken){
      throw new ApiError("Failed to generate host token", 500);
    }
    // 3. Generate Participant Token
    
    const guestParticipant = {
      participantName: participant.participantName,
      role: participant.role,
    };
    const participantToken = await generateToken({
      roomName,
      user: user,
      participant: guestParticipant,
    });
    if(!participantToken){
      throw new ApiError("Failed to generate participant token", 500);
    }
    const serverUrl = process.env.LIVEKIT_URL;
    if (!serverUrl) {
      throw new ApiError("LiveKit server URL is not configured", 500);
    }

    const origin = request.nextUrl.origin;
    const hostLink = `${origin}/meet/${roomName}#token=${hostToken}&userName=${user.userName}`;
    const participantLink = `${origin}/meet/${roomName}#token=${participantToken}&userName=${participant.participantName}`;

    return ApiResponse.success({
      roomName,
      hostLink,
      participantLink,
      serverUrl,
    }, "Meeting generated successfully");
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to initialize meeting", 500);
  }
}
