import {
  EgressClient,
  EncodedFileOutput,
  S3Upload,
  EncodingOptions,
  EgressInfo,
} from "livekit-server-sdk";
import { config } from "../../utils/config";
import { logger } from "@/server/utils/logger";

export async function startRoomRecording(roomName: string, filepath: string) :  Promise<EgressInfo | null> {
  // const customBaseUrl = config.NEXT_PUBLIC_API_URL;
  const host =  (config.LIVEKIT_URL)
    .replace("wss://", "https://")
    .replace("ws://", "http://");
  const client = new EgressClient(host, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
  const s3Bucket = config.AWS_S3_BUCKET_NAME;
  const s3AccessKey = config.AWS_ACCESS_KEY_ID || "";
  const s3Secret = config.AWS_SECRET_ACCESS_KEY || "";
  const s3Region = config.AWS_S3_REGION;
  // const recordingUrl = `${customBaseUrl}/meet/${roomName}?recorder=true`;
  if(!s3Bucket || !s3AccessKey || !s3Secret || !s3Region) {
    if(config.NODE_ENV === "production") {
      throw new Error("AWS S3 configuration is missing. Recording cannot be started.");
    }
    logger.error("AWS S3 configuration is missing. skipping the recording.");
    return null;
  }
  // Starts recording the room using a web-composite template and uploads to S3
  const egressInfo = await client.startRoomCompositeEgress(
    roomName,
    new EncodedFileOutput({
      filepath: filepath,
      output: {
        case: "s3",
        value: new S3Upload({
          accessKey: s3AccessKey,
          secret: s3Secret,
          region: s3Region,
          bucket: s3Bucket,
        }),
      },
    }),
    {
      layout: "speaker",
      encodingOptions: new EncodingOptions({
        width: 1920,
        height: 1080,
        framerate: 30,
        videoBitrate: 6000,
        audioBitrate: 256,
      }),
    },
  );
  return egressInfo;
}

export async function stopEgress(egressId: string): Promise<EgressInfo> {
  const host = (config.LIVEKIT_URL)
    .replace("wss://", "https://")
    .replace("ws://", "http://");
  const client = new EgressClient(host, config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
  const egressInfo = await client.stopEgress(egressId);
  return egressInfo;
}
