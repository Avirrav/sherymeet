import mongoose from "mongoose";

const RecordingSchema = new mongoose.Schema(
  {
    meetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meet",
      required: true,
      index: true,
    },

    roomId: {
      type: String,
      required: true,
      index: true,
    },

    egressId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    recordingStatus: {
      type: String,
      enum: [
        "starting",
        "recording",
        "completed",
        "failed",
        "aborted",
      ],
      default: "starting",
    },

    startedAt: Date,

    endedAt: Date,

    duration: Number,

    /**
     * LiveKit Track IDs
     */
    trackIds: [
      {
        type: String,
      },
    ],

    /**
     * S3 Storage Info
     */
    s3Bucket: String,

    s3Region: String,

    s3ObjectKey: String,

    /**
     * Final Public / Signed URL
     */
    recordingUrl: String,

    /**
     * LiveKit File Results
     */
    fileResults: [
      {
        filename: String,
        location: String,
        size: Number,
      },
    ],

    /**
     * Error Handling
     */
    error: {
      code: String,
      message: String,
    },

    /**
     * Raw Webhook Response
     * Future debugging ke liye
     */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Recording || mongoose.model("Recording", RecordingSchema);
