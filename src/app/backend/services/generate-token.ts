import { AccessToken } from 'livekit-server-sdk';

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

interface GenerateTokenOptions {
  roomName: string;
  participantName: string;
  identity: string;
  metadata?: string;
}

export async function generateToken(options: GenerateTokenOptions): Promise<string> {
  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set');
  }

  const { roomName, participantName, identity, metadata } = options;

  // Create an AccessToken
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: participantName,
    metadata,
    ttl: '2h', // Token valid for 2 hours
  });

  // Grant video conferencing permissions
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  });

  return await at.toJwt();
}
