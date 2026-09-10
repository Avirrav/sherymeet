import mongoose, { Schema } from "mongoose";
import { config } from "../utils/config";
import {
  ConferenceRoomType,
  IConferenceRoomDocument,
  StatusType,
} from "../types/conferenceroom.types";

const ConferenceRoomSchema = new Schema<IConferenceRoomDocument>(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    roomCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    passcode: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(StatusType),
      default: StatusType.Scheduled,
    },
    type: {
      type: String,
      enum: Object.values(ConferenceRoomType),
      default: ConferenceRoomType.Meeting,
    },
    isRecording: {
      type: Boolean,
      default: false,
    },
    isTranscription: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

if (config.NODE_ENV === "development" && mongoose.models.ConferenceRoom) {
  delete mongoose.models.ConferenceRoom;
}

export default mongoose.models.ConferenceRoom ||
  mongoose.model<IConferenceRoomDocument>("ConferenceRoom", ConferenceRoomSchema);
