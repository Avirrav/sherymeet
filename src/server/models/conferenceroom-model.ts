import mongoose from "mongoose";
import { config } from "../utils/config";

const ConferenceRoomSchema = new mongoose.Schema(
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
      enum: ["scheduled", "active", "ended"],
      default: "scheduled",
    },
    type: {
      type: String,
      enum: ["webinar", "meet"],
      default: "meet",
    },
    isRecording: {
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
  mongoose.model("ConferenceRoom", ConferenceRoomSchema);
