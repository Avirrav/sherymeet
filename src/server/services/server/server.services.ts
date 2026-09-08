import { deleteRoom } from "../livekit/delete-room";
import { createRoom } from "../livekit/create-room";
import { stopEgress, startRoomRecording } from "../livekit/egress";
import { ConferenceRoomDao } from "../../dao/conferenceroom-dao";
import { RecordingDao } from "../../dao/recording-dao";
import { ApiError } from "../../utils/api-helper";
import { dbConnect } from "../../utils/db-connect";
import { logger } from "../../utils/logger";
import { config } from "../../utils/config";
import { StatusType, IConferenceRoomDocument } from "@/server/types/conferenceroom.types";

export interface EndSessionOptions {
  roomId: string;
}

export interface GetSessionOptions {
  roomId: string;
}

export interface StartSessionOptions {
  roomId: string;
}

// Public shape of a conference room, safe to return to the browser (never
// includes the passcode hash itself — just whether one is set).
export interface PublicMeetDetails {
  roomId: string;
  roomCode: string;
  status: StatusType;
  type: string;
  isRecording: boolean;
  hasPasscode: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
}

export function toPublicMeetDetails(room: IConferenceRoomDocument): PublicMeetDetails {
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    status: room.status,
    type: room.type,
    isRecording: room.isRecording,
    hasPasscode: Boolean(room.passcode),
    startedAt: room.startedAt,
    endedAt: room.endedAt,
  };
}

export async function endSession({ roomId }: EndSessionOptions): Promise<IConferenceRoomDocument> {
  await dbConnect();
  // 1. Fetch conference room
  const conferenceRoom = await ConferenceRoomDao.getConferenceRoomByRoomId(roomId);
  if (!conferenceRoom) {
    throw new ApiError("Meeting not found", 404);
  }
  if (conferenceRoom.status === StatusType.Ended) {
    return conferenceRoom;
  }
  // 2. Update status to ended in MongoDB
  const endedConferenceRoom = await ConferenceRoomDao.endConferenceRoom(roomId);
  if (!endedConferenceRoom) {
    throw new ApiError("Failed to end meeting in database", 500);
  }

  // 3. Stop any active recordings (egress) associated with this room
  try {
    const activeRecordings = await RecordingDao.getActiveRecordingsByRoomId(roomId);
    for (const rec of activeRecordings) {
      logger.info(`Stopping egress recording for room: ${roomId}, egressId: ${rec.egressId}`);
      try {
        await stopEgress(rec.egressId);
        await RecordingDao.updateRecording(rec.egressId, {
          recordingStatus: "completed", // Webhook will update this with final file results, but update locally first
          endedAt: new Date(),
        });
      } catch (egrErr) {
        logger.error(`Failed to stop egress ${rec.egressId}`, egrErr);
        // If stopping fails (e.g. already stopped), set to failed/completed depending on context
        await RecordingDao.updateRecording(rec.egressId, {
          recordingStatus: "failed",
          endedAt: new Date(),
        });
      }
    }
  } catch (recErr) {
    logger.error("Error stopping room recordings", recErr);
  }

  // 4. Delete the room on LiveKit server
  try {
    await deleteRoom(roomId);
  } catch (lkErr) {
    logger.error(`Failed to delete room ${roomId} on LiveKit`, lkErr);
    // Ignore if room does not exist on LiveKit anymore
  }

  return endedConferenceRoom;
}

export async function startSession({
  roomId,
}: StartSessionOptions): Promise<IConferenceRoomDocument> {
  await dbConnect();

  const conferenceRoom = await ConferenceRoomDao.getConferenceRoomByRoomId(roomId);
  if (!conferenceRoom) {
    throw new ApiError("Meeting not found", 404);
  }
  if (conferenceRoom.status === StatusType.Ended) {
    throw new ApiError("Meeting already ended", 400);
  }
  if (conferenceRoom.status === StatusType.Active) {
    return conferenceRoom;
  }

  // Room must exist on the LiveKit server before Egress can record it.
  await createRoom(roomId);

  const startedConferenceRoom = await ConferenceRoomDao.startConferenceRoom(roomId);
  if (!startedConferenceRoom) {
    // Lost a race with a concurrent start — re-fetch and return the
    // now-active room rather than erroring.
    const current = await ConferenceRoomDao.getConferenceRoomByRoomId(roomId);
    if (current?.status === StatusType.Active) {
      return current;
    }
    throw new ApiError("Failed to start meeting", 500);
  }

  if (startedConferenceRoom.isRecording) {
    try {
      const filepath = `recordings/${roomId}_${Date.now()}.mp4`;
      const egressInfo = await startRoomRecording(roomId, filepath);
      if (egressInfo?.egressId) {
        await RecordingDao.createRecording({
          conferenceRoomId: String(startedConferenceRoom._id),
          roomId,
          egressId: egressInfo.egressId,
          recordingStatus: "recording",
          startedAt: new Date(),
          s3Bucket: config.AWS_S3_BUCKET_NAME,
          s3Region: config.AWS_S3_REGION,
          s3ObjectKey: filepath,
        });
        logger.info(
          `Meeting recording started for room ${roomId} with egressId: ${egressInfo.egressId}`,
        );
      }
    } catch (recError) {
      logger.error("Failed to start meeting recording", recError);
      // Log and continue — the host can still join even if recording fails.
    }
  }

  return startedConferenceRoom;
}

export async function getSessionDetails({
  roomId,
}: GetSessionOptions): Promise<IConferenceRoomDocument> {
  if (!roomId) {
    throw new ApiError("Room ID is required", 400);
  }
  const sessionDetails = await ConferenceRoomDao.getConferenceRoomByRoomId(roomId);
  if (!sessionDetails) {
    throw new ApiError("Meeting not found", 404);
  }
  return sessionDetails;
}
