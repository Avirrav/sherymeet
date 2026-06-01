import { EgressClient, EncodedFileOutput } from 'livekit-server-sdk';

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const livekitUrl = process.env.LIVEKIT_URL;

export async function startRoomRecording(roomName: string, filepath: string) {
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set');
  }

  const host = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const client = new EgressClient(host, apiKey, apiSecret);

  // Starts recording the room using a web-composite template
  const egressInfo = await client.startRoomCompositeEgress(roomName, {
    file: new EncodedFileOutput({
      filepath: filepath,
    }),
  });

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
