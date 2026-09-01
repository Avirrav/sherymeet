import { RoomServiceClient } from 'livekit-server-sdk';
import { config } from '../../utils/config';

const apiKey = config.LIVEKIT_API_KEY;
const apiSecret = config.LIVEKIT_API_SECRET;
const livekitUrl = config.LIVEKIT_URL;

export async function deleteRoom(roomName: string): Promise<void> {
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set');
  }

  const host = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const roomService = new RoomServiceClient(host, apiKey, apiSecret);

  await roomService.deleteRoom(roomName);
}
