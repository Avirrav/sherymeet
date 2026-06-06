import { NextRequest } from "next/server";
import { generateToken } from "@/app/backend/services/media-server-services/generate-token";
import { createRoom } from "@/app/backend/services/media-server-services/create-room";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";
import { IParticipant } from "@/app/backend/interfaces/user-interface";
import { MeetDao } from "@/app/backend/dao/meet-dao";
import bcrypt from "bcryptjs";

/**
 * POST /api/private/meet/join-as-host
 * Generates an Access Token for joining a specific room as a host, verifies role hierarchy,
 * triggers LiveKit room creation, and returns the signed token.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomId, user, maxParticipants, passcode } = body;
    if (!roomId) {
      throw new ApiError("Room ID is required", 400);
    }
    if (!user) {
      throw new ApiError("User details are required", 400);
    }
    if (!user.userName || !user.role) {
      throw new ApiError("User userName and role are required", 400);
    }
    // Fetch meeting details from database
    const meet = await MeetDao.getMeetByRoomId(roomId);
    if (!meet) {
      throw new ApiError("Meeting not found", 404);
    }
    // Check meeting status
    if (meet.status === "ended") {
      throw new ApiError("Meeting already ended", 400);
    }
    // Verify passcode if set
    if (meet.passcode) {
      if (!passcode) {
        throw new ApiError("Passcode is required to join this meeting", 400);
      }
      const isMatch = await bcrypt.compare(passcode, meet.passcode);
      if (!isMatch) {
        throw new ApiError("Invalid passcode", 401);
      }
    }
    // 1. Map the user to IParticipant structure
    const participant: IParticipant = {
      participantName: user.userName,
      role: user.role,
    };
    // 2. Generate connection token (checks role internally for MENTOR / ADMIN grants)
    const token = await generateToken({
      roomName: roomId,
      user,
      participant,
    });
    if (!token) {
      throw new ApiError("Failed to generate token", 500);
    }
    // 3. Ensure the room is instantiated on the Media Server
    const room = await createRoom(roomId, maxParticipants || 2);
    if (!room.name) {
      throw new ApiError("Failed to create room", 500);
    }
    // 4. Update the meeting status to 'active' and record startedAt timestamp in MongoDB
    if (meet.status === "scheduled") {
      console.log(
        `Updating database meet status to active for room: ${roomId}`,
      );
      const updatedMeet = await MeetDao.startMeet(roomId);
      if (!updatedMeet) {
        // In case of concurrent joins starting it at the exact same moment, double check
        const currentMeet = await MeetDao.getMeetByRoomId(roomId);
        if (!currentMeet || currentMeet.status !== "active") {
          throw new ApiError("Failed to update meeting status", 500);
        }
      }
    }
    const serverUrl = process.env.LIVEKIT_URL;
    if (!serverUrl) {
      throw new ApiError("LiveKit server URL is not configured", 500);
    }
    const meetLink=`${process.env.NEXT_PUBLIC_LIVEKIT_URL}/meet/${roomId}`;
    return ApiResponse.success(
      {
        token,
        roomId,
        serverUrl,
        meetLink,
      },
      "Room created successfully, Meeting started.",
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return ApiResponse.failure(error.message, error.statusCode, error.errors);
    }
    const err = error instanceof Error ? error : new Error(String(error));
    return ApiResponse.failure(err.message || "Failed to join meeting", 500);
  }
}
