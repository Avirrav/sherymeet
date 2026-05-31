import { RoomServiceClient, Room } from 'livekit-server-sdk';

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const livekitUrl = process.env.LIVEKIT_URL;

export async function createRoom(roomName: string, emptyTimeout: number = 600): Promise<Room> {
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set');
  }

  // Convert wss:// to https://
  const host = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  
  const roomService = new RoomServiceClient(host, apiKey, apiSecret);

  // Check if room already exists
  const existingRooms = await roomService.listRooms([roomName]);
  if (existingRooms.length > 0) {
    return existingRooms[0];
  }

  // Create new room
  return await roomService.createRoom({
    name: roomName,
    emptyTimeout,
    maxParticipants: 2, // 1:1 call constraint
  });
}
