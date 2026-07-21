import mongoose from "mongoose";

const MeetSchema = new mongoose.Schema(
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

if (process.env.NODE_ENV === "development" && mongoose.models.Meet) {
  delete mongoose.models.Meet;
}

export default mongoose.models.Meet || mongoose.model("Meet", MeetSchema);
