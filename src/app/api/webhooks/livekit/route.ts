import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver, EgressStatus } from "livekit-server-sdk";
import { RecordingDao, IRecordingUpdate } from "@/server/dao/recording-dao";
import { RecordingStatus } from "@/server/types/conferenceroom.types";
import { dbConnect } from "@/server/utils/db-connect";
import { logger } from "@/server/utils/logger";
import { config } from "@/server/utils/config";

export enum WebhookEventNames {
  ROOM_STARTED = "room_started",
  ROOM_FINISHED = "room_finished",
  PARTICIPANT_JOINED = "participant_joined",
  PARTICIPANT_LEFT = "participant_left",
  PARTICIPANT_CONNECTION_ABORTED = "participant_connection_aborted",
  TRACK_PUBLISHED = "track_published",
  TRACK_UNPUBLISHED = "track_unpublished",
  EGRESS_STARTED = "egress_started",
  EGRESS_UPDATED = "egress_updated",
  EGRESS_ENDED = "egress_ended",
  INGRESS_STARTED = "ingress_started",
  INGRESS_ENDED = "ingress_ended",
}

const apiKey = config.LIVEKIT_API_KEY;
const apiSecret = config.LIVEKIT_API_SECRET;

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
      if (config.NODE_ENV !== "development") {
        logger.warn("Rejected LiveKit webhook with invalid signature", err);
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
      logger.warn(
        "Webhook signature verification failed. Parsing raw JSON directly for development.",
        err,
      );
      event = JSON.parse(bodyText);
    }
    logger.info(`Received LiveKit Webhook event: ${event.event}`);
    // Egress updates (starting, active, ending, complete, failed)
    if (
      event.event === WebhookEventNames.EGRESS_ENDED ||
      event.event === WebhookEventNames.EGRESS_UPDATED
    ) {
      logger.info(
        `Processing egress event for egressId: ${event.egressInfo?.egressId} with status: ${event.egressInfo?.status}`,
      );
      const egressInfo = event.egressInfo;
      if (egressInfo && egressInfo.egressId) {
        const egressId = egressInfo.egressId;
        // Find the recording document in MongoDB via RecordingDao
        const recording = await RecordingDao.getRecording({ egressId });
        if (recording) {
          const statusVal = egressInfo.status;
          let recordingStatus: RecordingStatus = RecordingStatus.RECORDING;
          if (statusVal === 0 || statusVal === EgressStatus.EGRESS_STARTING) {
            recordingStatus = RecordingStatus.STARTING;
          } else if (statusVal === 1 || statusVal === EgressStatus.EGRESS_ACTIVE) {
            recordingStatus = RecordingStatus.RECORDING;
          } else if (statusVal === 2 || statusVal === EgressStatus.EGRESS_ENDING) {
            recordingStatus = RecordingStatus.ENDING;
          } else if (statusVal === 3 || statusVal === EgressStatus.EGRESS_COMPLETE) {
            recordingStatus = RecordingStatus.COMPLETED;
          } else if (statusVal === 4 || statusVal === EgressStatus.EGRESS_FAILED) {
            recordingStatus = RecordingStatus.FAILED;
          } else if (statusVal === 5 || statusVal === EgressStatus.EGRESS_ABORTED) {
            recordingStatus = RecordingStatus.ABORTED;
          } else if (statusVal === 6 || statusVal === EgressStatus.EGRESS_LIMIT_REACHED) {
            logger.warn(`LiveKit Egress ${egressId} reached its limit.`);
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
            logger.error(
              `LiveKit Egress ${egressId} reported error during execution/upload: ${egressInfo.error}`,
            );
          }
          // Populate S3 file results if present
          if (egressInfo.fileResults && egressInfo.fileResults.length > 0) {
            updateData.fileResults = egressInfo.fileResults.map(
              (f: { filename: string; location: string; size: number | string }) => ({
                filename: f.filename,
                location: f.location,
                size: Number(f.size),
              }),
            );
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
          await RecordingDao.updateRecording({ egressId }, updateData);
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
