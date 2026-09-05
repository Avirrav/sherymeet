import mongoose from "mongoose";
import { config } from "../utils/config";

const MeetRegistrantSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// One registration per email per webinar.
MeetRegistrantSchema.index({ roomId: 1, email: 1 }, { unique: true });

if (config.NODE_ENV === "development" && mongoose.models.MeetRegistrant) {
  delete mongoose.models.MeetRegistrant;
}

export default mongoose.models.MeetRegistrant ||
  mongoose.model("MeetRegistrant", MeetRegistrantSchema);
