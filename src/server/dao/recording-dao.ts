import { dbConnect } from "@/server/utils/db-connect";
import Recording from "@/server/models/recording-model";
import {
  IRecordingDocument,
  RecordingStatus,
  IRecordingFileResult,
  IRecordingError,
} from "@/server/types/conferenceroom.types";

export interface ICreateRecordingInput {
  conferenceRoomId: string;
  roomId: string;
  egressId: string;
  recordingStatus: RecordingStatus;
  startedAt: Date;
  s3Bucket: string;
  s3Region: string;
  s3ObjectKey: string;
}

export interface IRecordingUpdate {
  recordingStatus?: RecordingStatus;
  endedAt?: Date;
  duration?: number;
  s3Bucket?: string;
  s3Region?: string;
  s3ObjectKey?: string;
  recordingUrl?: string;
  fileResults?: IRecordingFileResult[];
  error?: IRecordingError;
}

export class RecordingDao {
  /**
   * Creates and saves a new Recording document.
   */
  static async createRecording(data: ICreateRecordingInput): Promise<IRecordingDocument> {
    await dbConnect();
    const recording = new Recording(data);
    return await recording.save();
  }

  /**
   * Retrieves all recordings for a room that are currently active (recording).
   */
  static async getActiveRecordingsByRoomId(roomId: string): Promise<IRecordingDocument[]> {
    await dbConnect();
    return await Recording.find({ roomId, recordingStatus: "recording" });
  }

  /**
   * Retrieves a recording record by its egress ID.
   */
  static async getRecordingByEgressId(egressId: string): Promise<IRecordingDocument | null> {
    await dbConnect();
    return await Recording.findOne({ egressId });
  }

  /**
   * Updates recording properties in MongoDB.
   */
  static async updateRecording(
    egressId: string,
    updateData: IRecordingUpdate,
  ): Promise<IRecordingDocument | null> {
    await dbConnect();
    return await Recording.findOneAndUpdate(
      { egressId },
      { $set: updateData },
      { returnDocument: "after" },
    );
  }
}
