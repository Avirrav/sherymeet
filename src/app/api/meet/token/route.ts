import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/services/livekit/generate-token';
import { RoomServiceClient } from 'livekit-server-sdk';

export async function POST(request: NextRequest) {
  try {
    const { roomName, participantName } = await request.json();

    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'Missing roomName or participantName' },
        { status: 400 }
      );
    }

    const serverUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!serverUrl || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'LiveKit server config is not set' },
        { status: 500 }
      );
    }

    // Verify room size before generating a token
    try {
      const host = serverUrl.replace('wss://', 'https://').replace('ws://', 'http://');
      const roomService = new RoomServiceClient(host, apiKey, apiSecret);
      const activeParticipants = await roomService.listParticipants(roomName);
      
      if (activeParticipants && activeParticipants.length >= 2) {
        return NextResponse.json(
          { error: 'Room is full. Participant limit (2) reached for this meeting.' },
          { status: 400 }
        );
      }
    } catch (e) {
      // Room might not exist yet on the server (first person joining), ignore
      console.log('Room capacity check skipped:', e);
    }

    // Generate secure participant identity
    const identity = `${participantName}_${Math.random().toString(36).substring(2, 6)}`;

    // Call service layer to generate token
    const token = await generateToken({
      roomName,
      participantName,
      identity,
    });

    return NextResponse.json({
      success: true,
      token,
      serverUrl,
      roomId: roomName,
    });
  } catch (err: any) {
    console.error('Token generation API error:', err);
    return NextResponse.json(
      { error: err?.message || 'Token generation failed' },
      { status: 500 }
    );
  }
}
