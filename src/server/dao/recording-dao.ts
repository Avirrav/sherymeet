import mongoose, { ClientSession } from "mongoose";
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

export interface IRecordingQueryOptions {
  select?: QuerySelect;
  sort?: QuerySort<IRecordingDocument>;
  limit?: number;
  session?: ClientSession;
}

export class RecordingDao {
  /**
   * Starts a new MongoDB session for transactions.
   */
  static async startSession(): Promise<ClientSession> {
    await dbConnect();
    return await mongoose.startSession();
  }

  /**
   * Creates and saves a new Recording document.
   */
  static async createRecording(
    data: ICreateRecordingInput,
    session?: ClientSession,
  ): Promise<IRecordingDocument> {
    await dbConnect();
    const recording = new Recording(data);
    return await recording.save({ session });
  }

  /**
   * Retrieves a single recording matching the given filter.
   */
  static async getRecording(
    filter: QueryFilter<IRecordingDocument>,
    options?: { select?: QuerySelect; session?: ClientSession },
  ): Promise<IRecordingDocument | null> {
    await dbConnect();
    let query = Recording.findOne(filter);
    if (options?.select) {
      query = query.select(options.select);
    }
    if (options?.session) {
      query = query.session(options.session);
    }
    return await query;
  }

  /**
   * Retrieves multiple recordings matching the given filter.
   */
  static async getRecordings(
    filter: QueryFilter<IRecordingDocument>,
    options?: IRecordingQueryOptions,
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
    if (options?.session) {
      query = query.session(options.session);
    }
    return await query;
  }

  /**
   * Updates recording properties in MongoDB.
   */
  static async updateRecording(
    filter: QueryFilter<IRecordingDocument>,
    updateData: IRecordingUpdate,
    session?: ClientSession,
  ): Promise<IRecordingDocument | null> {
    await dbConnect();
    return await Recording.findOneAndUpdate(
      filter,
      { $set: updateData },
      {
        returnDocument: "after",
        session,
      },
    );
  }
}
