import { dbConnect } from "@/server/utils/db-connect";
import Recording from "@/server/models/recording-model";
import {
  IRecordingDocument,
  RecordingStatus,
  IRecordingFileResult,
  IRecordingError,
} from "@/server/types/conferenceroom.types";
import { QueryFilter, QuerySelect, QuerySort } from "@/server/types/dao.types";

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
   * Retrieves a single recording matching the given filter.
   */
  static async getRecording(
    filter: QueryFilter<IRecordingDocument>,
    select?: QuerySelect,
  ): Promise<IRecordingDocument | null> {
    await dbConnect();
    let query = Recording.findOne(filter);
    if (select) {
      query = query.select(select);
    }
    return await query;
  }

  /**
   * Retrieves multiple recordings matching the given filter.
   */
  static async getRecordings(
    filter: QueryFilter<IRecordingDocument>,
    options?: { select?: QuerySelect; sort?: QuerySort<IRecordingDocument>; limit?: number },
  ): Promise<IRecordingDocument[]> {
    await dbConnect();
    let query = Recording.find(filter);
    if (options?.select) {
      query = query.select(options.select);
    }
    if (options?.sort) {
      query = query.sort(options.sort);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    return await query;
  }

  /**
   * Updates recording properties in MongoDB.
   */
  static async updateRecording(
    filter: QueryFilter<IRecordingDocument>,
    updateData: IRecordingUpdate,
  ): Promise<IRecordingDocument | null> {
    await dbConnect();
    return await Recording.findOneAndUpdate(
      filter,
      { $set: updateData },
      { returnDocument: "after" },
    );
  }
}
