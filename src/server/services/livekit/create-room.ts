import { RoomServiceClient, Room } from "livekit-server-sdk";
import { config } from "../../utils/config";
const apiKey = config.LIVEKIT_API_KEY;
const apiSecret = config.LIVEKIT_API_SECRET;
const livekitUrl = config.LIVEKIT_URL;
const roomEmptyTimeout = config.ROOM_EMPTY_TIMEOUT; // 5 minutes

// Helper to generate a format like abc-defg-hij
function generateRoomCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part(3)}-${part(4)}-${part(3)}`;
}

// Create Room Service
export async function createRoom(roomName?: string, maxParticipants: number = 10): Promise<Room> {
  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error("LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set");
  }
  if (!roomName) {
    roomName = generateRoomCode();
  }
  // Convert wss:// to https://
  const host = livekitUrl.replace("wss://", "https://").replace("ws://", "http://");
  const roomService = new RoomServiceClient(host, apiKey, apiSecret);
  // Check if room already exists
  try {
    const existingRooms = await roomService.listRooms([roomName]);
    if (existingRooms.length > 0) {
      return existingRooms[0];
    }
  } catch (error) {
    throw new Error("Failed to list rooms: " + error);
  }
  try {
    return await roomService.createRoom({
      name: roomName,
      emptyTimeout: Number(roomEmptyTimeout),
      maxParticipants,
    });
  } catch (error) {
    throw new Error("Failed to create room: " + error);
  }
}
