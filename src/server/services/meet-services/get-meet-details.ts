import { MeetDao } from "../../dao/meet-dao";
import { ApiError } from "../../utils/api-helper";

interface GetMeetDetailsOptions {
  roomId: string;
}

/**
 * Public shape of a meeting: only the fields the meet page needs. The raw
 * document must never leave the backend — it carries the bcrypt passcode
 * hash and internal Mongo fields.
 */
export interface PublicMeetDetails {
  roomId: string;
  roomCode: string;
  status: "scheduled" | "active" | "ended";
  type: "webinar" | "meet";
  isRecording: boolean;
  hasPasscode: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
}

/**
 * Maps a raw Meet document to its public shape.
 */
export function toPublicMeetDetails(meet: {
  roomId: string;
  roomCode: string;
  status: "scheduled" | "active" | "ended";
  type: "webinar" | "meet";
  isRecording: boolean;
  passcode?: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
}): PublicMeetDetails {
  return {
    roomId: meet.roomId,
    roomCode: meet.roomCode,
    status: meet.status,
    type: meet.type,
    isRecording: meet.isRecording,
    hasPasscode: !!meet.passcode,
    startedAt: meet.startedAt,
    endedAt: meet.endedAt,
  };
}

/**
 * Retrieves the public meeting details from the database by its room ID.
 */
export async function getMeetDetails({ roomId }: GetMeetDetailsOptions): Promise<PublicMeetDetails> {
  if (!roomId) {
    throw new ApiError("Room ID is required", 400);
  }

  const meet = await MeetDao.getMeetByRoomId(roomId);
  if (!meet) {
    throw new ApiError("Meeting not found", 404);
  }

  return toPublicMeetDetails(meet);
}
