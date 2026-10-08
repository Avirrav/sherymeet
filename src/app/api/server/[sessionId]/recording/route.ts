import { NextRequest } from "next/server";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { verifyRoomToken } from "@/server/services/livekit/verify-room-token";
import {
  startRoomRecording,
  stopRoomRecording,
  getActiveRoomEgress,
} from "@/server/services/livekit/egress";
import { ConferenceRoomDao } from "@/server/dao/conferenceroom-dao";
import { StatusType } from "@/server/types/conferenceroom.types";
import { dbConnect } from "@/server/utils/db-connect";
import Recording from "@/server/models/recording-model";
import { config } from "@/server/utils/config";

async function validateRequest(request: NextRequest, roomId: string) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new ApiError("Room token required", 401);

  const verified = await verifyRoomToken(token, roomId);
  if (!verified.roomAdmin) throw new ApiError("Only hosts can control recording", 403);

  const room = await ConferenceRoomDao.getConferenceRoom({ roomId });
  if (!room || room.status !== StatusType.Active) {
    throw new ApiError("Meeting not found or not active", 404);
  }

  return { verified, room };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId: roomId } = await params;
    if (!roomId) throw new ApiError("Room ID is required", 400);

    await validateRequest(request, roomId);
    await dbConnect();

    // Check MongoDB for active recording first
    const activeRecording = await Recording.findOne({
      roomId,
      recordingStatus: { $in: ["starting", "recording"] },
    });

    // Also verify with LiveKit
    const activeEgress = await getActiveRoomEgress(roomId);

    return ApiResponse.success({
      isRecording: !!activeRecording || !!activeEgress,
      egressId: activeRecording?.egressId || activeEgress?.egressId || null,
      status: activeRecording?.recordingStatus || (activeEgress ? "recording" : null),
    });
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to get recording status");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId: roomId } = await params;
    if (!roomId) throw new ApiError("Room ID is required", 400);

    await validateRequest(request, roomId);
    await dbConnect();

    // Atomic check: only allow if isRecording is false
    const updatedRoom = await ConferenceRoomDao.updateConferenceRoomAtomic(
      { roomId, isRecording: false },
      { isRecording: true },
    );

    if (!updatedRoom) {
      // Check if recording already active
      const existingRoom = await ConferenceRoomDao.getConferenceRoom({ roomId });
      if (existingRoom?.isRecording) {
        throw new ApiError("Recording is already active for this room", 409);
      }
      throw new ApiError("Failed to start recording - room state conflict", 409);
    }

    // Double-check no active recording in MongoDB
    const existingRecording = await Recording.findOne({
      roomId,
      recordingStatus: { $in: ["starting", "recording"] },
    });

    if (existingRecording) {
      // Revert the isRecording flag
      await ConferenceRoomDao.updateConferenceRoomByRoomId(roomId, {
        isRecording: false,
      });
      throw new ApiError("Recording is already active for this room", 409);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filepath = `recordings/${roomId}/${timestamp}.mp4`;

    let egressInfo;
    try {
      egressInfo = await startRoomRecording(roomId, filepath);
    } catch (err) {
      // Revert the isRecording flag on failure
      await ConferenceRoomDao.updateConferenceRoomByRoomId(roomId, {
        isRecording: false,
      });
      throw err;
    }

    if (!egressInfo) {
      // Revert the isRecording flag
      await ConferenceRoomDao.updateConferenceRoomByRoomId(roomId, {
        isRecording: false,
      });
      throw new ApiError("Failed to start recording - S3 not configured", 500);
    }

    // Create recording document
    await Recording.create({
      conferenceRoomId: updatedRoom._id,
      roomId,
      egressId: egressInfo.egressId,
      recordingStatus: "recording",
      startedAt: new Date(),
      s3Bucket: config.AWS_S3_BUCKET_NAME,
      s3Region: config.AWS_S3_REGION,
      s3ObjectKey: filepath,
    });

    return ApiResponse.success({
      isRecording: true,
      egressId: egressInfo.egressId,
      status: "recording",
    });
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to start recording");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  let roomId: string | undefined;

  try {
    const { sessionId } = await params;
    roomId = sessionId;
    if (!roomId) throw new ApiError("Room ID is required", 400);

    await validateRequest(request, roomId);
    await dbConnect();

    // Find active recording in MongoDB
    const activeRecording = await Recording.findOne({
      roomId,
      recordingStatus: { $in: ["starting", "recording"] },
    });

    // Try to stop via LiveKit (may fail if egress already stopped)
    let stoppedEgress = null;
    try {
      stoppedEgress = await stopRoomRecording(roomId);
    } catch {
      // Ignore LiveKit errors - egress may already be stopped
    }

    // Update MongoDB recording status
    if (activeRecording) {
      await Recording.findByIdAndUpdate(activeRecording._id, {
        recordingStatus: "completed",
        endedAt: new Date(),
      });
    }

    // Always update conference room flag
    await ConferenceRoomDao.updateConferenceRoomByRoomId(roomId, {
      isRecording: false,
    });

    if (!stoppedEgress && !activeRecording) {
      return ApiResponse.success({
        isRecording: false,
        message: "No active recording to stop",
      });
    }

    return ApiResponse.success({
      isRecording: false,
      egressId: stoppedEgress?.egressId || activeRecording?.egressId,
      status: "completed",
    });
  } catch (error) {
    // Ensure flag is reset even on error
    if (roomId) {
      try {
        await ConferenceRoomDao.updateConferenceRoomByRoomId(roomId, {
          isRecording: false,
        });
      } catch {
        // Ignore cleanup errors
      }
    }
    return ApiResponse.fromError(error, "Failed to stop recording");
  }
}
