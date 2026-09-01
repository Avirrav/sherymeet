import { dbConnect } from "@/server/utils/db-connect";
import Meet from "@/server/models/meet-model";

export class MeetDao {
  /**
   * Creates and saves a new Meet document in MongoDB.
   * Ensures database connection is active first.
   */
  static async createMeet(meetData: {
    roomId: string;
    roomCode: string;
    status?: "scheduled" | "active" | "ended";
    type?: "webinar" | "meet";
    startedAt?: Date | null;
    endedAt?: Date | null;
    passcode?: string | null;
    isRecording?: boolean;
  }) {
    await dbConnect();
    const meet = new Meet(meetData);
    const savedMeet = await meet.save()

    const meetObj = savedMeet.toObject();
    delete meetObj._id;
    delete meetObj.passcode;
    delete meetObj.createdAt;
    delete meetObj.updatedAt;
    delete meetObj.__v;
    
    return meetObj;
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
      { returnDocument: "after" },
    );
  }

  /**
   * Retrieves a meeting record by its room ID.
   */
  static async getMeetByRoomId(roomId: string) {
    await dbConnect();
    return await Meet.findOne({ roomId });
  }

  /**
   * Updates the meeting status to 'ended' and records the endedAt timestamp.
   */
  static async endMeet(roomId: string) {
    await dbConnect();
    return await Meet.findOneAndUpdate(
      { roomId },
      {
        $set: {
          status: "ended",
          endedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );
  }
}
