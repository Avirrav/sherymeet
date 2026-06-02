import { NextRequest } from "next/server";
import { generateToken } from "@/app/backend/services/generate-token";
import { RoomServiceClient } from "livekit-server-sdk";
import { ApiError, ApiResponse } from "@/app/backend/utils/api-helper";

export async function POST(request: NextRequest) {
  try {
    const { roomName, user, participant } = await request.json();

    if (!roomName) {
      throw new ApiError("Missing roomName", 400);
    }
    if (!user || !participant) {
      throw new ApiError("Missing user or participant details", 400);
    }

    const serverUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!serverUrl || !apiKey || !apiSecret) {
      throw new ApiError("LiveKit server config is not set", 500);
    }

    // Verify room size before generating a token
    try {
      const host = serverUrl
        .replace("wss://", "https://")
        .replace("ws://", "http://");
      const roomService = new RoomServiceClient(host, apiKey, apiSecret);
      const activeParticipants = await roomService.listParticipants(roomName);

      if (activeParticipants && activeParticipants.length >= 2) {
        throw new ApiError(
          "Room is full. Participant limit (2) reached for this meeting.",
          400,
        );
      }
    } catch (unknownErr) {
      if (unknownErr instanceof ApiError) {
        throw unknownErr;
      }
      // Room might not exist yet on the server (first person joining), ignore
      console.log(
        "Room capacity check skipped:",
        unknownErr instanceof Error ? unknownErr.message : String(unknownErr),
      );
    }

    // Call service layer to generate token
    const token = await generateToken({
      roomName,
      user,
      participant,
    });

    return ApiResponse.success({
      token,
      serverUrl,
      roomId: roomName,
    });
  } catch (unknownErr) {
    if (unknownErr instanceof ApiError) {
      console.error("Token generation API error:", unknownErr.message);
      return ApiResponse.failure(
        unknownErr.message,
        unknownErr.statusCode,
        unknownErr.errors,
      );
    }
    const err =
      unknownErr instanceof Error ? unknownErr : new Error(String(unknownErr));
    console.error("Token generation API error:", err);
    return ApiResponse.failure(err.message || "Token generation failed", 500);
  }
}
