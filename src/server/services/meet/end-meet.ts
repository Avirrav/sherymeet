import { deleteRoom } from "../media-server-services/delete-room";
import { stopEgress } from "../media-server-services/egress";
import { MeetDao } from "../../dao/meet-dao";
import { RecordingDao } from "../../dao/recording-dao";
import { ApiError } from "../../utils/api-helper";
import { dbConnect } from "../../utils/db-connect";
import { logger } from "../../utils/logger";

interface EndMeetOptions {
  roomId: string;
}

export async function endMeet({ roomId }: EndMeetOptions) {
  await dbConnect();

  // 1. Fetch meeting
  const meet = await MeetDao.getMeetByRoomId(roomId);
  if (!meet) {
    throw new ApiError("Meeting not found", 404);
  }

  if (meet.status === "ended") {
    return meet; // Already ended
  }

  // 2. Update meet status to ended in MongoDB
  const endedMeet = await MeetDao.endMeet(roomId);
  if (!endedMeet) {
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

  return endedMeet;
}
