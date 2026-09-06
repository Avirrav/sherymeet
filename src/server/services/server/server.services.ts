import { deleteRoom } from "../livekit/delete-room";
import { stopEgress } from "../livekit/egress";
import { ConferenceRoomDao } from "../../dao/conferenceroom-dao";
import { RecordingDao } from "../../dao/recording-dao";
import { ApiError } from "../../utils/api-helper";
import { dbConnect } from "../../utils/db-connect";
import { logger } from "../../utils/logger";
import { StatusType, IConferenceRoomDocument } from "@/server/types/conferenceroom.types";

export interface EndSessionOptions {
  roomId: string;
}

export interface GetSessionOptions {
  roomId: string;
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
