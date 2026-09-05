import { dbConnect } from "@/server/utils/db-connect";
import Meet from "@/server/models/meet-model";
import { StatusType, MeetType, meet, IMeetDocument } from "@/server/types/meet.types";

export interface ICreateMeetInput {
  roomId: string;
  roomCode: string;
  status?: StatusType;
  type?: MeetType;
  startedAt?: Date | null;
  endedAt?: Date | null;
  passcode?: string | null;
  isRecording?: boolean;
}

export class MeetDao {
  /**
   * Creates and saves a new Meet document in MongoDB.
   * Ensures database connection is active first.
   */
  static async createMeet(meetData: ICreateMeetInput): Promise<Partial<meet>> {
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
  static async startMeet(roomId: string): Promise<IMeetDocument | null> {
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
  static async getMeetByRoomId(roomId: string): Promise<IMeetDocument | null> {
    await dbConnect();
    return await Meet.findOne({ roomId });
  }

  /**
   * Updates the meeting status to 'ended' and records the endedAt timestamp.
   */
  static async endMeet(roomId: string): Promise<IMeetDocument | null> {
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
