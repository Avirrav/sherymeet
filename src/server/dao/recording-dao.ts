import { dbConnect } from "@/server/utils/db-connect";
import Recording from "@/server/models/recording-model";

export class RecordingDao {
  /**
   * Creates and saves a new Recording document.
   */
  static async createRecording(data: {
    meetId:string;
    roomId: string;
    egressId: string;
    recordingStatus: string;
    startedAt: Date;
    s3Bucket: string;
    s3Region: string;
    s3ObjectKey: string;
  }) {
    await dbConnect();
    const recording = new Recording(data);
    return await recording.save();
  }

  /**
   * Retrieves all recordings for a room that are currently active (recording).
   */
  static async getActiveRecordingsByRoomId(roomId: string) {
    await dbConnect();
    return await Recording.find({ roomId, recordingStatus: "recording" });
  }

  /**
   * Retrieves a recording record by its egress ID.
   */
  static async getRecordingByEgressId(egressId: string) {
    await dbConnect();
    return await Recording.findOne({ egressId });
  }

  /**
   * Updates recording properties in MongoDB.
   */
  static async updateRecording(egressId: string, updateData: IRecordingUpdate) {
    await dbConnect();
    return await Recording.findOneAndUpdate(
      { egressId },
      { $set: updateData },
      { returnDocument: "after" }
    );
  }
}

export interface IRecordingUpdate {
  recordingStatus?: string;
  endedAt?: Date;
  duration?: number;
  s3Bucket?: string;
  s3Region?: string;
  s3ObjectKey?: string;
  recordingUrl?: string;
  fileResults?: Array<{
    filename: string;
    location: string;
    size: number;
  }>;
  error?: {
    code: string;
    message: string;
  };
}
