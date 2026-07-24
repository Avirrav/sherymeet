import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { RecordingDao, IRecordingUpdate } from "@/app/backend/dao/recording-dao";
import { dbConnect } from "@/app/backend/utils/db-connect";
import { logger } from "@/app/backend/utils/logger";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const bodyText = await request.text();
    const authHeader = request.headers.get("Authorization");

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "LiveKit credentials not configured" }, { status: 500 });
    }

    let event;
    try {
      const receiver = new WebhookReceiver(apiKey, apiSecret);
      event = await receiver.receive(bodyText, authHeader || "");
    } catch (err) {
      // Unsigned payloads are only tolerated in local development; in any
      // other environment a failed signature check must reject the request,
      // otherwise anyone can forge egress events and corrupt recording state.
      if (process.env.NODE_ENV !== "development") {
        logger.warn("Rejected LiveKit webhook with invalid signature", err);
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
      logger.warn("Webhook signature verification failed. Parsing raw JSON directly for development.", err);
      event = JSON.parse(bodyText);
    }

    logger.info(`Received LiveKit Webhook event: ${event.event}`);

    // Egress updates (starting, active, ending, complete, failed)
    if (event.event === "egress_ended" || event.event === "egress_updated") {
      const egressInfo = event.egressInfo;
      if (egressInfo && egressInfo.egressId) {
        const egressId = egressInfo.egressId;

        // Find the recording document in MongoDB via RecordingDao
        const recording = await RecordingDao.getRecordingByEgressId(egressId);
        if (recording) {
          const statusVal = egressInfo.status;
          let recordingStatus = "recording";

          // LiveKit status values mapping:
          // EGRESS_STARTING = 1, EGRESS_ACTIVE = 2, EGRESS_ENDING = 3, EGRESS_COMPLETE = 4, EGRESS_FAILED = 5
          if (statusVal === 4 || statusVal === "EGRESS_COMPLETE") {
            recordingStatus = "completed";
          } else if (statusVal === 5 || statusVal === "EGRESS_FAILED") {
            recordingStatus = "failed";
          }

          const updateData: IRecordingUpdate = {
            recordingStatus,
            endedAt: new Date(),
          };

          if (egressInfo.error) {
            updateData.error = {
              code: "EGRESS_UPLOAD_FAILED",
              message: egressInfo.error,
            };
            logger.error(`LiveKit Egress ${egressId} reported error during execution/upload: ${egressInfo.error}`);
          }

          // Populate S3 file results if present
          if (egressInfo.fileResults && egressInfo.fileResults.length > 0) {
            updateData.fileResults = egressInfo.fileResults.map((f: { filename: string; location: string; size: number | string }) => ({
              filename: f.filename,
              location: f.location,
              size: Number(f.size),
            }));

            // Save the S3 path and public URL
            updateData.recordingUrl = egressInfo.fileResults[0].location;
            updateData.s3ObjectKey = egressInfo.fileResults[0].filename;
          } else if (egressInfo.file) {
            updateData.recordingUrl = egressInfo.file.location;
            updateData.s3ObjectKey = egressInfo.file.filename;
          }

          if (egressInfo.duration) {
            // Convert nanoseconds to seconds
            updateData.duration = Math.round(Number(egressInfo.duration) / 1_000_000_000);
          }

          await RecordingDao.updateRecording(egressId, updateData);
          logger.info(`Updated recording ${egressId} database status to: ${recordingStatus}`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Webhook processing error", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
