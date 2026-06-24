'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useRoomConnection } from '@/hooks/media-server/useRoomConnection';
import PreJoinScreen from '@/features/meet/PreJoinScreen';
import ConferenceRoom from '@/features/meet/ConferenceRoom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface MeetingPageClientProps {
  roomId: string;
  token: string;
  userName?: string;
  isRecorder?: boolean;
}

export default function MeetingPageClient({ roomId, token, userName, isRecorder = false }: MeetingPageClientProps) {
  const {
    username,
    isConnected,
    isConnecting,
    setUsername,
    setMeetingInfo,
    setConnectionStatus,
    resetMeetingStore,
  } = useMeetingStore();

  const [serverUrl, setServerUrl] = useState('');
  const [hasEntered, setHasEntered] = useState(false);
  const [activeToken, setActiveToken] = useState('');

  // Reset the meeting store state, extract parameters from search or hash, and prefill username
  useEffect(() => {
    resetMeetingStore();
    let resolvedUserName = userName || '';
    let resolvedToken = token || '';
    if (typeof window !== 'undefined') {
      // 1. Check hash fragment (prevents parameter logging in server-side logs)
      const hash = window.location.hash.substring(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        resolvedToken = params.get('token') || resolvedToken;
        resolvedUserName = params.get('userName') || resolvedUserName;
      }    
    }
    const timer = setTimeout(() => {
      if (resolvedUserName) {
        setUsername(resolvedUserName);
      }
      if (resolvedToken) {
        setActiveToken(resolvedToken);
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      resetMeetingStore();
    };
  }, [resetMeetingStore, userName, token, setUsername]);

  const handleJoin = useCallback(async () => {
    setConnectionStatus(true, false, null);
    if (activeToken) {
        const envUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
        if (!envUrl) {
          throw new Error('NEXT_PUBLIC_LIVEKIT_URL environment variable is not defined on the client');
        }
        setServerUrl(envUrl);
        setMeetingInfo(roomId, activeToken);
        setHasEntered(true);
    } else {
      toast.error("Token is not available, not access to join meeting.")
      setHasEntered(false);
      setConnectionStatus(false, false, null);
    }
  }, [activeToken, roomId, setConnectionStatus, setMeetingInfo]);

  useEffect(() => {
    if (isRecorder && activeToken && !hasEntered) {
      const timer = setTimeout(() => {
        handleJoin();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isRecorder, activeToken, hasEntered, handleJoin]);

  const room = useRoomConnection({
    serverUrl,
    token: hasEntered ? activeToken : '',
  });

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
      return <ConferenceRoom room={room} isRecorder={isRecorder} />;
    }
  }

  // Render the pre-join preview screen by default
  return <PreJoinScreen roomId={roomId} onJoin={handleJoin} userName={username} />;
}
