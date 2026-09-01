import { NextRequest } from "next/server";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { MeetDao } from "@/server/dao/meet-dao";
import { RecordingDao } from "@/server/dao/recording-dao";
import { verifyRoomToken } from "@/server/services/media-server-services/verify-room-token";
import { createRoom } from "@/server/services/media-server-services/create-room";
import { startRoomRecording } from "@/server/services/media-server-services/egress";
import { logger } from "@/server/utils/logger";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { serverApiMiddleware } from "@/server/middleware/server-api-middleware";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { ipRateLimitMiddleware } from "@/server/middleware/ip-rate-limit-middleware";
import { parseJsonBody, serverRoomTokenSchema } from "@/server/validation/meet-schemas";

/**
 * POST /api/server/meet/start-meeting
 * Called when the host clicks "Start Meeting". Re-verifies roomAdmin
 * server-side, creates the LiveKit room, flips the meet to active, and
 * (only if the meet was created with recording enabled) starts the Egress
 * recording pipeline. Idempotent: a second call on an already-active
 * meeting is a no-op so retries/reloads don't double-trigger egress.
 */
export async function startMeetingHandler(request: NextRequest) {
  try {
    const { roomId, token } = await parseJsonBody(request, serverRoomTokenSchema);

    const { roomAdmin } = await verifyRoomToken(token, roomId);
    if (!roomAdmin) {
      throw new ApiError("Unauthorized: only the host can start the meeting", 403);
    }

    const meet = await MeetDao.getMeetByRoomId(roomId);
    if (!meet) {
      throw new ApiError("Meeting not found", 404);
    }

    if (meet.status === "ended") {
      throw new ApiError("Meeting already ended", 400);
    }
    if (meet.status === "active") {
      return ApiResponse.success({ status: meet.status, isRecording: meet.isRecording });
    }

    // Room must exist on the LiveKit server before Egress can record it.
    await createRoom(roomId);

    const updatedMeet = await MeetDao.startMeet(roomId);
    if (!updatedMeet) {
      // startMeet only flips scheduled -> active, so a null here usually means
      // a concurrent request won the race. Treat an already-active meet as
      // success instead of a 500.
      const current = await MeetDao.getMeetByRoomId(roomId);
      if (current?.status === "active") {
        return ApiResponse.success({ status: current.status, isRecording: current.isRecording });
      }
      throw new ApiError("Failed to start meeting", 500);
    }

    if (updatedMeet.isRecording) {
      // Start meeting recording when the host starts the room
      try {
        const filepath = `recordings/${roomId}_${Date.now()}.mp4`;
        const egressInfo = await startRoomRecording(roomId, filepath);
        if (egressInfo && egressInfo.egressId) {
          await RecordingDao.createRecording({
            meetId: updatedMeet._id,
            roomId: roomId,
            egressId: egressInfo.egressId,
            recordingStatus: "recording",
            startedAt: new Date(),
            s3Bucket: process.env.AWS_S3_BUCKET_NAME || "sherymeet-recordings",
            s3Region: process.env.AWS_REGION || "ap-south-1",
            s3ObjectKey: filepath,
          });
          logger.info(`Meeting recording started for room ${roomId} with egressId: ${egressInfo.egressId}`);
        }
      } catch (recError) {
        logger.error("Failed to start meeting recording", recError);
        // We log and continue so the host can still join even if recording service fails
      }
    }

    return ApiResponse.success({ status: updatedMeet.status, isRecording: updatedMeet.isRecording });
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to start meeting");
  }
}

export const POST = runMiddlewares(
  [requestIdMiddleware, ipRateLimitMiddleware, serverApiMiddleware],
  startMeetingHandler,
);
