'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Room, ConnectionState, Participant, LocalParticipant } from 'livekit-client';
import { useParticipants } from '@/hooks/livekit/useParticipants';
import { useScreenShare } from '@/hooks/livekit/useScreenShare';
import { useChat } from '@/hooks/livekit/useChat';
import { useConnectionQuality } from '@/hooks/livekit/useConnectionQuality';
import { useMeetingStore } from '@/store/useMeetingStore';
import ParticipantTile from './ParticipantTile';
import ChatPanel from './ChatPanel';
import ParticipantsPanel from './ParticipantsPanel';
import WaitingState from './WaitingState';
import LeaveConfirmModal from './LeaveConfirmModal';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranscribe } from '@/hooks/livekit/useTranscribe';
import CaptionOverlay from './CaptionOverlay';

import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  MonitorOff,
  Hand,
  MessageSquare,
  Users,
  LogOut,
  Clock,
  Subtitles,
} from 'lucide-react';

interface ConferenceRoomProps {
  room: Room;
}

export default function ConferenceRoom({ room }: ConferenceRoomProps) {
  const router = useRouter();
  const {
    roomId,
    audioEnabled,
    videoEnabled,
    toggleCamera,
    toggleMicrophone,
    activeSidebar,
    toggleSidebar,
    unreadChatCount,
    captionsEnabled,
    toggleCaptions,
  } = useMeetingStore();

  const { localParticipant, remoteParticipants, activeSpeaker, updateKey } = useParticipants(room);
  const { isScreenSharing, toggleScreenShare } = useScreenShare(room);
  const { raiseHand, isHandRaised } = useChat(room);
  const qualities = useConnectionQuality(room);

  // Initialize and run the auto-transcription / live captions hook
  useTranscribe(room);

  // States
  const [duration, setDuration] = useState(0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Find screen share track (from remote or local) directly during render
  const remoteSharePub = remoteParticipants
    .flatMap((p) => Array.from(p.videoTrackPublications.values()))
    .find((pub) => pub.source === 'screen_share' && pub.track);

  const localSharePub = Array.from(room.localParticipant.videoTrackPublications.values()).find(
    (pub) => pub.source === 'screen_share' && pub.track
  );

  const activeScreenShareTrack = remoteSharePub?.track || localSharePub?.track || null;

  // Bind screen share video element
  useEffect(() => {
    const el = screenShareVideoRef.current;
    if (!el || !activeScreenShareTrack) return;

    activeScreenShareTrack.attach(el);
    return () => {
      activeScreenShareTrack.detach(el);
    };
  }, [activeScreenShareTrack]);

  const handleLeaveConfirm = () => {
    room.disconnect();
    toast.info('Left the meeting');
    router.push('/');
  };

  const getTopParticipantQuality = () => {
    if (!localParticipant) return 'excellent';
    return qualities[localParticipant.identity] || localParticipant.connectionQuality;
  };

  const renderQualityBadge = () => {
    const quality = getTopParticipantQuality();
    let text = 'Connection: Stable';
    let dotColor = 'bg-green-500';

    if (quality === 'poor') {
      text = 'Connection: Unstable';
      dotColor = 'bg-red-500 animate-ping';
    } else if (quality === 'good') {
      text = 'Connection: Fair';
      dotColor = 'bg-yellow-500';
    }

    return (
      <div className="flex items-center gap-1.5 bg-brand-surface/80 border border-brand-border px-3 py-1 rounded-xl text-xs text-brand-text-secondary">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span>{text}</span>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col justify-between bg-brand-dark text-white overflow-hidden relative font-sans">
      
      {/* Top Bar */}
      <header className="bg-brand-surface/60 border-b border-brand-border/60 px-6 py-4 flex items-center justify-between z-10 glass-panel">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img
              src="https://px.pixxo.io/sheryians/favicon_FuNGo5cLy.webp"
              alt="Sheryians Logo"
              className="w-5 h-5 object-contain"
            />
            <span className="text-sm font-bold uppercase tracking-wider text-white">
              1:1 Meet
            </span>
          </div>
          <span className="text-brand-border">|</span>
          <span className="text-xs font-semibold text-brand-text-secondary font-mono tracking-wide">
            Room Code: {roomId}
          </span>
        </div>

        {/* Info indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-brand-surface/80 border border-brand-border px-3 py-1 rounded-xl text-xs text-brand-text-secondary font-mono">
            <Clock className="w-3.5 h-3.5 text-brand-orange" />
            <span>{formatDuration(duration)}</span>
          </div>
          {renderQualityBadge()}
        </div>

        {/* Leave */}
        <button
          onClick={() => setShowLeaveModal(true)}
          className="flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Leave</span>
        </button>
      </header>

      {/* Main Grid + Sidebar Container */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden relative">
          
          {/* Waiting for remote participant */}
          {remoteParticipants.length === 0 ? (
            <WaitingState roomId={roomId} />
          ) : (
            /* Meeting Layout */
            <div className="w-full h-full relative flex items-center justify-center">
              
              {/* Screen Share Mode */}
              {activeScreenShareTrack ? (
                <div className="w-full h-full flex flex-col gap-4 relative">
                  {/* Big Central Screen Share Feed */}
                  <div className="flex-1 bg-black/40 border border-brand-border rounded-3xl overflow-hidden relative flex items-center justify-center">
                    <video
                      ref={screenShareVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 text-xs text-white">
                      Active Screen Share
                    </div>
                  </div>

                  {/* Sidebar / Floating participant thumbnails */}
                  <div className="absolute bottom-4 right-4 flex gap-3 z-10">
                    <div className="w-48 aspect-video">
                      <ParticipantTile
                        participant={remoteParticipants[0]}
                        isLocal={false}
                        isSpeaker={activeSpeaker?.identity === remoteParticipants[0].identity}
                      />
                    </div>
                    {localParticipant && (
                      <div className="w-48 aspect-video">
                        <ParticipantTile
                          participant={localParticipant}
                          isLocal={true}
                          isSpeaker={activeSpeaker?.identity === localParticipant.identity}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Standard 1:1 Video Layout - Side by Side */
                <div className="w-full h-full flex items-center justify-center p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl animate-scale-in">
                    {remoteParticipants[0] && (
                      <div className="aspect-video w-full">
                        <ParticipantTile
                          participant={remoteParticipants[0]}
                          isLocal={false}
                          isSpeaker={activeSpeaker?.identity === remoteParticipants[0].identity}
                        />
                      </div>
                    )}
                    {localParticipant && (
                      <div className="aspect-video w-full">
                        <ParticipantTile
                          participant={localParticipant}
                          isLocal={true}
                          isSpeaker={activeSpeaker?.identity === localParticipant.identity}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* Real-time Captions Overlay */}
          <CaptionOverlay room={room} />
        </div>

        {/* Sidebar panel */}
        {activeSidebar === 'chat' && (
          <ChatPanel room={room} onClose={() => toggleSidebar('chat')} />
        )}
        {activeSidebar === 'participants' && (
          <ParticipantsPanel room={room} onClose={() => toggleSidebar('participants')} />
        )}

      </div>

      {/* Controls Bar */}
      <footer className="bg-brand-surface/60 border-t border-brand-border/60 py-4 px-6 flex items-center justify-center gap-4 z-10 glass-panel">
        <div className="flex items-center gap-3">
          
          {/* Mute Mic */}
          <button
            onClick={toggleMicrophone}
            className={`p-3.5 rounded-xl transition-all border ${
              audioEnabled
                ? 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
                : 'bg-red-500/20 border-red-500/40 text-red-500 hover:bg-red-500/35'
            }`}
            title={audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
          >
            {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={toggleCamera}
            className={`p-3.5 rounded-xl transition-all border ${
              videoEnabled
                ? 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
                : 'bg-red-500/20 border-red-500/40 text-red-500 hover:bg-red-500/35'
            }`}
            title={videoEnabled ? 'Stop Camera' : 'Start Camera'}
          >
            {videoEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            disabled={remoteParticipants.length === 0}
            className={`p-3.5 rounded-xl transition-all border disabled:opacity-30 disabled:pointer-events-none ${
              isScreenSharing
                ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
                : 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
            }`}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Raise Hand */}
          <button
            onClick={() => raiseHand(!isHandRaised)}
            disabled={remoteParticipants.length === 0}
            className={`p-3.5 rounded-xl transition-all border disabled:opacity-30 disabled:pointer-events-none ${
              isHandRaised
                ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
                : 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
            }`}
            title="Raise Hand"
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Captions Toggle */}
          <button
            onClick={() => toggleCaptions()}
            className={`p-3.5 rounded-xl transition-all border ${
              captionsEnabled
                ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
                : 'bg-brand-surface hover:bg-brand-border text-brand-text-secondary hover:text-white border-brand-border'
            }`}
            title={captionsEnabled ? 'Disable Captions' : 'Enable Captions'}
          >
            <Subtitles className="w-5 h-5" />
          </button>

          <span className="text-brand-border mx-1">|</span>

          {/* Chat Sidebar Toggle */}
          <button
            onClick={() => toggleSidebar('chat')}
            className={`p-3.5 rounded-xl transition-all border relative ${
              activeSidebar === 'chat'
                ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
                : 'bg-brand-surface hover:bg-brand-border text-brand-text-secondary hover:text-white border-brand-border'
            }`}
            title="Chat Panel"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && activeSidebar !== 'chat' && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-orange border-2 border-brand-dark flex items-center justify-center text-[9px] font-extrabold text-white animate-scale-in">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Participants Sidebar Toggle */}
          <button
            onClick={() => toggleSidebar('participants')}
            className={`p-3.5 rounded-xl transition-all border ${
              activeSidebar === 'participants'
                ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
                : 'bg-brand-surface hover:bg-brand-border text-brand-text-secondary hover:text-white border-brand-border'
            }`}
            title="Participants Panel"
          >
            <Users className="w-5 h-5" />
          </button>

        </div>
      </footer>

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <LeaveConfirmModal
          onConfirm={handleLeaveConfirm}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}

    </div>
  );
}
