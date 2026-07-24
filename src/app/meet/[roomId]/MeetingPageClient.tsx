'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Room } from 'livekit-client';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useRoomConnection } from '@/hooks/media-server/useRoomConnection';
import { initEmbedBridge, emitEmbedEvent } from '@/features/meet/embed-bridge';
import PreJoinScreen from '@/features/meet/PreJoinScreen';
import ConferenceRoom from '@/features/meet/ConferenceRoom';
import { Loader2, Clock, RefreshCw, Lock, PlayCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';

interface MeetingPageClientProps {
  roomId: string;
  token: string;
  userName?: string;
  email?: string;
  isRecorder?: boolean;
}

type GateStatus = 'verifying' | 'noAccess' | 'start' | 'waitingHost' | 'ready' | 'error';

function GateScreen({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-brand-dark flex flex-col justify-center items-center overflow-hidden font-sans p-6 animate-screen-in">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md glass-panel rounded-2xl border border-brand-border/40 p-8 flex flex-col items-center text-center shadow-2xl animate-fade-in-up">
        <div className="mb-8 flex items-center gap-4 bg-brand-surface/40 border border-brand-border/40 px-5 py-3 rounded-xl backdrop-blur-md">
          <Image
            src="https://dfdx9u0psdezh.cloudfront.net/logos/full-logo.webp"
            alt="Sheryians Coding School"
            width={160}
            height={38}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>

        <div className="w-16 h-16 rounded-full bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center text-brand-orange mb-6 animate-pulse-slow">
          {icon}
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-brand-text-primary mb-3">{title}</h1>
        <p className="text-sm text-brand-text-secondary leading-relaxed mb-8 max-w-sm">{description}</p>

        <div className="w-full flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

export default function MeetingPageClient({ roomId, token, userName, email, isRecorder = false }: MeetingPageClientProps) {
  const {
    username,
    isConnected,
    isConnecting,
    setUsername,
    setEmail,
    setMeetingInfo,
    setConnectionStatus,
    resetMeetingStore,
    meetDetails,
    setMeetDetails,
  } = useMeetingStore();

  const [serverUrl, setServerUrl] = useState('');
  const [hasEntered, setHasEntered] = useState(false);
  const [activeToken, setActiveToken] = useState('');
  const [gateStatus, setGateStatus] = useState<GateStatus>('verifying');
  const [gateMessage, setGateMessage] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const verifyParamsRef = useRef({ token: '', password: '' });
  const roomRef = useRef<Room | null>(null);
  const gateStatusRef = useRef<GateStatus>('verifying');
  const wasConnectedRef = useRef(false);

  // Confirms the token is genuine and routes by the native roomAdmin grant:
  // hosts either land straight in (meeting already active) or see the Start
  // Meeting screen; participants with a valid token land in when the meeting
  // is active, or wait for the host to start it.
  const verifyToken = useCallback(async () => {
    const { token: tokenToVerify, password } = verifyParamsRef.current;
    setGateStatus('verifying');
    try {
      const res = await fetch('/api/server/meet/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, token: tokenToVerify, password: password || undefined }),
      });
      const result = await res.json();
      if (!result.success) {
        setGateMessage(result.message || 'This meeting link is no longer valid.');
        setGateStatus('error');
        return;
      }
      if (result.data?.meet) {
        setMeetDetails(result.data.meet);
      }
      if (result.data?.meetStatus === 'ended') {
        setGateMessage('This meeting has already ended.');
        setGateStatus('error');
        emitEmbedEvent('meeting-ended', { roomId });
        return;
      }
      const isActive = result.data?.meetStatus === 'active';
      if (result.data?.roomAdmin) {
        setGateStatus(isActive ? 'ready' : 'start');
      } else {
        setGateStatus(isActive ? 'ready' : 'waitingHost');
      }
    } catch (err) {
      console.error('Error verifying meeting token:', err);
      setGateMessage('Could not reach the server to verify this meeting link.');
      setGateStatus('error');
    }
  }, [roomId, setMeetDetails]);

  // While a participant waits for the host, poll until the meeting goes active.
  useEffect(() => {
    if (gateStatus !== 'waitingHost') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/server/meet/details?roomId=${roomId}`, {
          headers: { Authorization: `Bearer ${verifyParamsRef.current.token}` },
        });
        const result = await res.json();
        if (result.success && result.data?.status === 'active') {
          setGateStatus('ready');
        } else if (result.success && result.data?.status === 'ended') {
          setGateMessage('This meeting has already ended.');
          setGateStatus('error');
          emitEmbedEvent('meeting-ended', { roomId });
        }
      } catch {
        // Transient network errors are fine here; keep polling.
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [gateStatus, roomId]);

  // Host-triggered: creates the LiveKit room, activates the meeting, and
  // (only if the meet was created with recording enabled) starts Egress.
  const startMeeting = useCallback(async () => {
    setIsStarting(true);
    try {
      const res = await fetch('/api/server/meet/start-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, token: verifyParamsRef.current.token }),
      });
      const result = await res.json();
      if (result.success) {
        setGateStatus('ready');
      } else {
        toast.error(result.message || 'Failed to start the meeting.');
      }
    } catch (err) {
      console.error('Error starting meeting:', err);
      toast.error('Could not reach the server to start the meeting.');
    } finally {
      setIsStarting(false);
    }
  }, [roomId]);

  // Reset the meeting store state, extract parameters from search or hash, and prefill username
  useEffect(() => {
    resetMeetingStore();
    let resolvedUserName = userName || '';
    let resolvedToken = token || '';
    let resolvedEmail = email || '';
    let resolvedPassword = '';
    if (typeof window !== 'undefined') {
      // 1. Check hash fragment (prevents parameter logging in server-side logs)
      const hash = window.location.hash.substring(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        resolvedToken = params.get('token') || resolvedToken;
        resolvedUserName = params.get('userName') || resolvedUserName;
        resolvedEmail = params.get('email') || resolvedEmail;
        resolvedPassword = params.get('password') || '';
      }
    }
    const timer = setTimeout(() => {
      if (resolvedUserName) {
        setUsername(resolvedUserName);
      }
      if (resolvedEmail) {
        setEmail(resolvedEmail);
      }
      if (!resolvedToken) {
        // No token means we can't prove roomAdmin at all.
        setGateStatus('noAccess');
        return;
      }
      setActiveToken(resolvedToken);
      verifyParamsRef.current = { token: resolvedToken, password: resolvedPassword };
      verifyToken();
    }, 0);
    return () => {
      clearTimeout(timer);
      resetMeetingStore();
    };
  }, [resetMeetingStore, userName, token, email, setUsername, setEmail, verifyToken]);

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
    if (isRecorder && gateStatus === 'ready' && activeToken && !hasEntered) {
      const timer = setTimeout(() => {
        handleJoin();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isRecorder, gateStatus, activeToken, hasEntered, handleJoin]);

  const room = useRoomConnection({
    serverUrl,
    token: hasEntered ? activeToken : '',
  });
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    gateStatusRef.current = gateStatus;
  }, [gateStatus]);

  // Embed SDK bridge: when this page runs inside the Sherymeet embed SDK's
  // iframe, report lifecycle events and honor leave/end commands.
  useEffect(() => {
    const cleanup = initEmbedBridge({
      getStatusSnapshot: () => ({ gateStatus: gateStatusRef.current, roomId }),
      onCommand: async (command) => {
        if (command === 'leave') {
          roomRef.current?.disconnect();
          return;
        }
        if (command === 'end') {
          try {
            await fetch('/api/server/meet/end-meet', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roomId, token: verifyParamsRef.current.token }),
            });
            emitEmbedEvent('meeting-ended', { roomId });
          } catch (err) {
            console.error('Error ending meeting from embed command:', err);
            emitEmbedEvent('error', { message: 'Failed to end the meeting' });
          }
          roomRef.current?.disconnect();
        }
      },
    });
    return cleanup;
  }, [roomId]);

  // Report gate transitions and join/leave to the embedding SDK.
  useEffect(() => {
    emitEmbedEvent('status', { gateStatus, roomId, message: gateMessage || undefined });
    if (gateStatus === 'error' && gateMessage) {
      emitEmbedEvent('error', { message: gateMessage });
    }
  }, [gateStatus, gateMessage, roomId]);

  useEffect(() => {
    if (isConnected && !wasConnectedRef.current) {
      wasConnectedRef.current = true;
      emitEmbedEvent('joined', { roomId });
    } else if (!isConnected && wasConnectedRef.current) {
      wasConnectedRef.current = false;
      emitEmbedEvent('left', { roomId });
    }
  }, [isConnected, roomId]);

  if (gateStatus === 'verifying') {
    return (
      <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-center animate-fade-in">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Verifying meeting link</h3>
        <p className="text-brand-text-secondary text-sm">Hang tight while we confirm access...</p>
      </div>
    );
  }

  if (gateStatus === 'noAccess') {
    return (
      <GateScreen
        icon={<Lock className="w-8 h-8" />}
        title="You don't have access to this meeting"
        description="This link is missing a valid access token. Ask the host or organizer for a fresh joining link."
      >
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center text-xs text-brand-text-secondary hover:text-brand-text-primary transition-colors py-2"
        >
          Go back home
        </Link>
      </GateScreen>
    );
  }

  if (gateStatus === 'error') {
    return (
      <GateScreen icon={<Clock className="w-8 h-8" />} title="Unable to join meeting" description={gateMessage}>
        <button
          type="button"
          onClick={verifyToken}
          className="btn-press inline-flex w-full items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white px-5 py-3 rounded-xl font-medium cursor-pointer shadow-lg shadow-brand-orange/20"
        >
          <RefreshCw className="w-4 h-4" />
          Check Status
        </button>
      </GateScreen>
    );
  }

  if (gateStatus === 'waitingHost') {
    return (
      <GateScreen
        icon={<Clock className="w-8 h-8" />}
        title="Waiting for the host"
        description="The meeting hasn't started yet. You'll be let in automatically as soon as the host starts it."
      >
        <div className="inline-flex w-full items-center justify-center gap-2 text-brand-text-secondary text-sm py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking for the host...
        </div>
      </GateScreen>
    );
  }

  if (gateStatus === 'start') {
    return (
      <GateScreen
        icon={<PlayCircle className="w-8 h-8" />}
        title="Ready to start the meeting?"
        description={
          meetDetails?.isRecording
            ? 'Starting the meeting will open the room to participants and automatically begin recording.'
            : 'Starting the meeting will open the room for participants to join.'
        }
      >
        <button
          type="button"
          onClick={startMeeting}
          disabled={isStarting}
          className="btn-press inline-flex w-full items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white px-5 py-3 rounded-xl font-medium cursor-pointer shadow-lg shadow-brand-orange/20 disabled:opacity-60 disabled:pointer-events-none"
        >
          {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {isStarting ? 'Starting...' : 'Start Meeting'}
        </button>
      </GateScreen>
    );
  }

  if (hasEntered) {
    if (isConnecting && !isConnected) {
      return (
        <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-center animate-fade-in">
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
