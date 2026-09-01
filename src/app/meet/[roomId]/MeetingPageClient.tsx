'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Room } from 'livekit-client';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useRoomConnection } from '@/hooks/media-server/useRoomConnection';
import { initEmbedBridge, emitEmbedEvent } from '@/components/meet/embed-bridge';
import PreJoinScreen from '@/components/meet/PreJoinScreen';
import ConferenceRoom from '@/components/meet/ConferenceRoom';
import { Loader2, Clock, RefreshCw, Lock, Lightbulb } from 'lucide-react';
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

/**
 * Full-bleed hero gate: an overhead spotlight, a glowing filled status disc,
 * an overline, a display-serif headline, and a single wide action. Used for
 * every pre-room state so they read as one family.
 */
function GateScreen({
  eyebrow,
  icon,
  title,
  description,
  tone = 'primary',
  children,
}: {
  eyebrow?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  tone?: 'primary' | 'error';
  children?: React.ReactNode;
}) {
  const discTone =
    tone === 'error'
      ? 'bg-md-error-container text-md-on-error-container'
      : 'bg-md-primary text-md-on-primary';
  const eyebrowTone = tone === 'error' ? 'text-md-error' : 'text-md-primary';

  return (
    <div className="min-h-screen bg-md-surface flex flex-col justify-center items-center p-6 animate-fade-in">
      <div className="flex flex-col items-center text-center max-w-xl">
        {/* Status disc */}
        <div
          className={`w-[104px] h-[104px] rounded-full flex items-center justify-center mb-10 ${discTone}`}
        >
          {icon}
        </div>

        {eyebrow && (
          <p className={`mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] ${eyebrowTone}`}>
            {eyebrow}
          </p>
        )}

        <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight text-md-on-surface mb-5 text-balance">
          {title}
        </h1>

        <p className="text-lg text-md-on-surface-variant leading-relaxed mb-11 max-w-md text-balance">
          {description}
        </p>

        <div className="w-full max-w-sm flex flex-col items-center gap-4">{children}</div>
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
      <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center text-center animate-fade-in p-6">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-md-primary animate-spin mb-8" />
          <h1 className="font-display text-4xl font-bold tracking-tight text-md-on-surface mb-3">
            Checking your invite
          </h1>
          <p className="text-md-on-surface-variant text-base">Just a moment while we confirm access.</p>
        </div>
      </div>
    );
  }

  if (gateStatus === 'noAccess') {
    return (
      <GateScreen
        eyebrow="Invite only"
        tone="error"
        icon={<Lock className="w-10 h-10" />}
        title="This door is locked"
        description="Your link is missing a valid access token. Ask the host for a fresh invite and you'll be right in."
      >
        <Link
          href="/"
          className="btn-press md-state-layer inline-flex items-center justify-center rounded-md-full border border-md-outline px-7 py-3 text-sm font-medium text-md-primary"
        >
          Go back home
        </Link>
      </GateScreen>
    );
  }

  if (gateStatus === 'error') {
    return (
      <GateScreen
        eyebrow="Something went wrong"
        tone="error"
        icon={<Clock className="w-10 h-10" />}
        title="We couldn't get you in"
        description={gateMessage}
      >
        <button
          type="button"
          onClick={verifyToken}
          className="btn-press inline-flex w-full items-center justify-center gap-2.5 bg-md-primary hover:bg-md-primary-hover text-md-on-primary px-8 py-4 rounded-md-full text-lg font-medium cursor-pointer"
        >
          <RefreshCw className="w-5 h-5" />
          Try again
        </button>
      </GateScreen>
    );
  }

  if (gateStatus === 'waitingHost') {
    return (
      <GateScreen
        eyebrow="Almost there"
        icon={<Clock className="w-11 h-11" />}
        title="Waiting in the wings"
        description="The host hasn't opened the room yet. Stay here — you'll be let in the moment they start."
      >
        <div className="inline-flex items-center justify-center gap-2.5 text-md-on-surface-variant text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Checking for the host...
        </div>
      </GateScreen>
    );
  }

  if (gateStatus === 'start') {
    return (
      <GateScreen
        eyebrow="The floor is yours"
        icon={<Lightbulb className="w-11 h-11" />}
        title="Take the stage"
        description={
          meetDetails?.isRecording
            ? "Open the room and your guests step in. Recording begins with you — you're the first voice they'll hear."
            : "Open the room and your guests step in. You're the first voice they'll hear."
        }
      >
        <button
          type="button"
          onClick={startMeeting}
          disabled={isStarting}
          className="btn-press inline-flex w-full items-center justify-center gap-2.5 bg-md-primary hover:bg-md-primary-hover text-md-on-primary px-8 py-4 rounded-md-full text-lg font-medium cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
        >
          {isStarting && <Loader2 className="w-5 h-5 animate-spin" />}
          {isStarting ? 'Starting...' : 'Start meeting'}
        </button>
      </GateScreen>
    );
  }

  if (hasEntered) {
    if (isConnecting && !isConnected) {
      return (
        <div className="min-h-screen bg-md-surface flex flex-col items-center justify-center text-center animate-fade-in">
          <Loader2 className="w-12 h-12 text-md-primary animate-spin mb-4" />
          <h3 className="text-xl font-bold text-md-on-surface mb-2">Connecting to Room</h3>
          <p className="text-md-on-surface-variant text-sm">Securing your peer connection...</p>
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
