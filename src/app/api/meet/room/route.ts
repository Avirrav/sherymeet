import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/services/livekit/create-room';

// Helper to generate a format like abc-defg-hij
function generateRoomCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const part = (len: number) => 
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part(3)}-${part(4)}-${part(3)}`;
}

export async function POST(request: NextRequest) {
  try {
    let roomName = '';
    
    // Check if custom roomName is provided, otherwise generate one
    try {
      const body = await request.json();
      roomName = body.roomName || '';
    } catch (e) {
      // Body might be empty, ignore
    }

    if (!roomName) {
      roomName = generateRoomCode();
    }

    // Call service layer to initialize room on LiveKit server
    const room = await createRoom(roomName);

    return NextResponse.json({
      success: true,
      roomName: room.name,
      sid: room.sid,
    });
  } catch (err: any) {
    console.error('Room creation API error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Room creation failed' },
      { status: 500 }
    );
  }
}
