import { dbConnect } from "@/server/utils/db-connect";
import ConferenceRoom from "@/server/models/conferenceroom-model";
import {
  StatusType,
  ConferenceRoomType,
  ConferenceRoom as IConferenceRoom,
  IConferenceRoomDocument,
} from "@/server/types/conferenceroom.types";

export interface ICreateConferenceRoomInput {
  roomId: string;
  roomCode: string;
  status?: StatusType;
  type?: ConferenceRoomType;
  startedAt?: Date | null;
  endedAt?: Date | null;
  passcode?: string | null;
  isRecording?: boolean;
  isTranscription?: boolean;
}

export class ConferenceRoomDao {
  /**
   * Creates and saves a new ConferenceRoom document in MongoDB.
   * Ensures database connection is active first.
   */
  static async createConferenceRoom(
    conferenceRoomData: ICreateConferenceRoomInput,
  ): Promise<Partial<IConferenceRoom>> {
    await dbConnect();
    const conferenceRoom = new ConferenceRoom(conferenceRoomData);
    const savedConferenceRoom = await conferenceRoom.save();
    const conferenceRoomObj = savedConferenceRoom.toObject();
    delete conferenceRoomObj._id;
    delete conferenceRoomObj.passcode;
    delete conferenceRoomObj.createdAt;
    delete conferenceRoomObj.updatedAt;
    delete conferenceRoomObj.__v;
    return conferenceRoomObj;
  }

  /**
   * Updates the room status to 'active' and records the startedAt timestamp
   * if the room is currently 'scheduled'.
   */
  static async startConferenceRoom(roomId: string): Promise<IConferenceRoomDocument | null> {
    await dbConnect();
    return await ConferenceRoom.findOneAndUpdate(
      { roomId, status: StatusType.Scheduled },
      {
        $set: {
          status: StatusType.Active,
          startedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );
  }

  /**
   * Retrieves a conference room record by its room ID.
   */
  static async getConferenceRoomByRoomId(roomId: string): Promise<IConferenceRoomDocument | null> {
    await dbConnect();
    return await ConferenceRoom.findOne({ roomId });
  }

  /**
   * Updates the room status to 'ended' and records the endedAt timestamp.
   */
  static async endConferenceRoom(roomId: string): Promise<IConferenceRoomDocument | null> {
    await dbConnect();
    return await ConferenceRoom.findOneAndUpdate(
      { roomId },
      {
        $set: {
          status: StatusType.Ended,
          endedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );
  }
}
