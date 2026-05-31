'use client';

import React, { useState, useEffect } from 'react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useRoomConnection } from '@/hooks/livekit/useRoomConnection';
import PreJoinScreen from '@/features/meet/PreJoinScreen';
import ConferenceRoom from '@/features/meet/ConferenceRoom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MeetingPageClientProps {
  roomId: string;
}

export default function MeetingPageClient({ roomId }: MeetingPageClientProps) {
  const {
    token,
    isConnected,
    isConnecting,
    error,
    setMeetingInfo,
    setConnectionStatus,
    resetMeetingStore,
  } = useMeetingStore();

  const [serverUrl, setServerUrl] = useState('');
  const [hasEntered, setHasEntered] = useState(false);

  // Reset the meeting store state when landing/leaving
  useEffect(() => {
    resetMeetingStore();
    return () => {
      resetMeetingStore();
    };
  }, [resetMeetingStore]);

  const handleJoin = async (username: string) => {
    setConnectionStatus(true, false, null);
    try {
      const response = await fetch('/api/meet/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomId,
          participantName: username,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setServerUrl(data.serverUrl);
        setMeetingInfo(roomId, data.token);
        setHasEntered(true);
      } else {
        throw new Error(data.error || 'Token generation failed');
      }
    } catch (err: any) {
      console.error('Error generating token:', err);
      setConnectionStatus(false, false, err?.message || 'Token generation failed');
      toast.error(err?.message || 'Token generation failed');
    }
  };

  // Connect to the room once token is fetched and user has hit Enter Meet
  const room = useRoomConnection({
    serverUrl,
    token: hasEntered ? token : '',
  });

  // Handle connection errors
  useEffect(() => {
    if (error) {
      toast.error(`Connection Error: ${error}`);
      setHasEntered(false);
    }
  }, [error]);

  if (hasEntered) {
    if (isConnecting && !isConnected) {
      return (
        <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-center">
          <Loader2 className="w-12 h-12 text-brand-orange animate-spin mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Connecting to Room</h3>
          <p className="text-brand-text-secondary text-sm">Securing your peer connection...</p>
        </div>
      );
    }

    if (isConnected && room) {
      return <ConferenceRoom room={room} />;
    }
  }

  // Render the pre-join preview screen by default
  return <PreJoinScreen roomId={roomId} onJoin={handleJoin} />;
}
