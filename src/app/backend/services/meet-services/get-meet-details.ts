import { MeetDao } from "../../dao/meet-dao";
import { ApiError } from "../../utils/api-helper";

interface GetMeetDetailsOptions {
  roomId: string;
}

/**
 * Retrieves the meeting details from the database by its room ID.
 */
export async function getMeetDetails({ roomId }: GetMeetDetailsOptions) {
  if (!roomId) {
    throw new ApiError("Room ID is required", 400);
  }

  const meet = await MeetDao.getMeetByRoomId(roomId);
  if (!meet) {
    throw new ApiError("Meeting not found", 404);
  }

  return meet;
}
