import { ConferenceRoomDao } from "@/server/dao/conferenceroom-dao";
import { ApiError } from "@/server/utils/api-helper";
import bcrypt from "bcryptjs";
import { ulid } from "ulid";
import {
  StatusType,
  ConferenceRoomType,
  ConferenceRoom,
  IConferenceRoomDocument,
} from "@/server/types/conferenceroom.types";
import { logger } from "@/server/utils/logger";
import { deleteRoom } from "../livekit/delete-room";
import { stopEgress } from "../livekit/egress";
import { RecordingDao } from "../../dao/recording-dao";
import { dbConnect } from "../../utils/db-connect";

export function generateWebinarId(): string {
  return ulid();
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

export async function createInstantWebinar(
  passcode: string,
  isRecording: boolean,
): Promise<Partial<ConferenceRoom>> {
  let hashedPasscode = null;
  const salt = await bcrypt.genSalt(10);
  hashedPasscode = await bcrypt.hash(passcode, salt);
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const webinarId = generateWebinarId();
    try {
      const webinar = await ConferenceRoomDao.createConferenceRoom({
        roomId: webinarId,
        roomCode: webinarId,
        status: StatusType.Scheduled,
        type: ConferenceRoomType.Webinar,
        startedAt: null,
        endedAt: null,
        passcode: hashedPasscode,
        isRecording: isRecording,
      });
      if (webinar) {
        return webinar;
      }
      throw new ApiError("Failed to create webinar", 500);
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < MAX_ATTEMPTS) {
        logger.warn(`Webinar ID collision on attempt ${attempt}, retrying`);
        continue;
      }
      throw err;
    }
  }
  // Unreachable in practice — the loop above always returns or throws — but
  // TS can't prove that from a for-loop's control flow, so this satisfies
  // both the compiler and defends against a future edit breaking that
  // invariant silently.
  throw new ApiError("Failed to create webinar after multiple attempts", 500);
}

export interface EndWebinarOptions {
  roomId: string;
}

export async function endWebinar({ roomId }: EndWebinarOptions): Promise<IConferenceRoomDocument> {
  await dbConnect();
  // 1. Fetch conference room
  const webinar = await ConferenceRoomDao.getConferenceRoomByRoomId(roomId);
  if (!webinar) {
    throw new ApiError("Meeting not found", 404);
  }
  if (webinar.status === StatusType.Ended) {
    return webinar;
  }
  // 2. Update status to ended in MongoDB
  const endedWebinar = await ConferenceRoomDao.endConferenceRoom(roomId);
  if (!endedWebinar) {
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

  return endedWebinar;
}
