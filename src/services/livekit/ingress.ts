import { IngressClient, IngressInput } from 'livekit-server-sdk';

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const livekitUrl = process.env.LIVEKIT_URL;

export async function createIngress(roomName: string, inputType: IngressInput = IngressInput.RTMP_INPUT) {
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set');
  }

  const host = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const client = new IngressClient(host, apiKey, apiSecret);

  // In livekit-server-sdk, options can be configured for resolution, encoding, etc.
  const ingress = await client.createIngress(inputType, {
    name: `${roomName}-ingress`,
    roomName: roomName,
    participantIdentity: `${roomName}-ingress-streamer`,
    participantName: 'External Streamer',
  });

  return ingress;
}

export async function listIngress(roomName?: string) {
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set');
  }

  const host = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const client = new IngressClient(host, apiKey, apiSecret);

  const ingresses = await client.listIngress({
    roomName: roomName || '',
  });

  return ingresses;
}
