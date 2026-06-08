import { EgressClient, EncodedFileOutput, S3Upload, EncodingOptions } from 'livekit-server-sdk';

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const livekitUrl = process.env.LIVEKIT_URL;

export async function startRoomRecording(roomName: string, filepath: string) {
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set');
  }

  const host = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const client = new EgressClient(host, apiKey, apiSecret);

  const s3Bucket = process.env.AWS_S3_BUCKET_NAME || 'sherymeet-recordings';
  const s3AccessKey = process.env.AWS_ACCESS_KEY_ID || '';
  const s3Secret = process.env.AWS_SECRET_ACCESS_KEY || '';
  const s3Region = process.env.AWS_REGION || 'ap-south-1';

  // Starts recording the room using a web-composite template and uploads to S3
  const egressInfo = await client.startRoomCompositeEgress(
    roomName,
    new EncodedFileOutput({
      filepath: filepath,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: s3AccessKey,
          secret: s3Secret,
          region: s3Region,
          bucket: s3Bucket,
        }),
      },
    }),
    {
      layout: 'speaker',
      encodingOptions: new EncodingOptions({
        width: 1920,
        height: 1080,
        framerate: 30,
        videoBitrate: 6000,
        audioBitrate: 256,
      }),
    }
  );

  return egressInfo;
}

export async function stopEgress(egressId: string) {
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set');
  }

  const host = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const client = new EgressClient(host, apiKey, apiSecret);

  const egressInfo = await client.stopEgress(egressId);
  return egressInfo;
}
