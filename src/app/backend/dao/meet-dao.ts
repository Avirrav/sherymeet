import { dbConnect } from "@/app/backend/utils/db-connect";
import Meet from "@/app/backend/models/meet-model";

export class MeetDao {
  /**
   * Creates and saves a new Meet document in MongoDB.
   * Ensures database connection is active first.
   */
  static async createMeet(meetData: {
    roomId: string;
    roomCode: string;
    status?: "scheduled" | "active" | "ended";
    startedAt?: Date | null;
    endedAt?: Date | null;
    host: {
      userId: string;
      username: string;
    };
    passcode?: string | null;
  }) {
    await dbConnect();
    const meet = new Meet(meetData);
    return await meet.save();
  }

  /**
   * Updates the meeting status to 'active' and records the startedAt timestamp
   * if the meeting is currently 'scheduled'.
   */
  static async startMeet(roomId: string) {
    await dbConnect();
    return await Meet.findOneAndUpdate(
      { roomId, status: "scheduled" },
      {
        $set: {
          status: "active",
          startedAt: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Retrieves a meeting record by its room ID.
   */
  static async getMeetByRoomId(roomId: string) {
    await dbConnect();
    return await Meet.findOne({ roomId });
  }
}
