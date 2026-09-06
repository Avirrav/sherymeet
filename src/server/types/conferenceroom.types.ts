import { Document, Types } from "mongoose";

export enum ConferenceRoomType {
  Webinar = "webinar",
  Meeting = "meeting",
}
export enum StatusType {
  Scheduled = "scheduled",
  Active = "active",
  Ended = "ended",
}

export interface ConferenceRoom {
  roomId: string;
  roomCode: string;
  status: StatusType;
  type: ConferenceRoomType;
  startedAt: Date | null;
  endedAt: Date | null;
  passcode: string | null;
  isRecording: boolean;
}

// IConferenceRoomDocument — the full Mongoose document returned by
// reads/updates (ConferenceRoomDao.getConferenceRoomByRoomId/startConferenceRoom/
// endConferenceRoom), as opposed to `ConferenceRoom` above which is the plain
// create-payload/sanitized shape.
export interface IConferenceRoomDocument extends Document {
  roomId: string;
  roomCode: string;
  status: StatusType;
  type: ConferenceRoomType;
  startedAt: Date | null;
  endedAt: Date | null;
  passcode: string | null;
  isRecording: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type RecordingStatus = "starting" | "recording" | "completed" | "failed" | "aborted";

export interface IRecordingFileResult {
  filename: string;
  location: string;
  size: number;
}

export interface IRecordingError {
  code: string;
  message: string;
}

// IRecordingDocument — the full Mongoose document for the Recording
// collection (see recording-model.ts).
export interface IRecordingDocument extends Document {
  conferenceRoomId: Types.ObjectId;
  roomId: string;
  egressId: string;
  recordingStatus: RecordingStatus;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  trackIds?: string[];
  s3Bucket?: string;
  s3Region?: string;
  s3ObjectKey?: string;
  recordingUrl?: string;
  fileResults?: IRecordingFileResult[];
  error?: IRecordingError;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// IMeetRegistrantDocument — the full Mongoose document for the
// MeetRegistrant collection (see meet-registrant.ts). Left as "Meet" —
// out of scope for the ConferenceRoom rename; it's a separate model.
export interface IMeetRegistrantDocument extends Document {
  webinarId: string;
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  joinUrl: string;
  createdAt: Date;
  updatedAt: Date;
}
