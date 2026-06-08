'use client';

import React, { useState, useEffect } from 'react';
import { Room } from 'livekit-client';
import { useParticipants } from '@/hooks/livekit/useParticipants';
import { useScreenShare } from '@/hooks/livekit/useScreenShare';
import { useChat } from '@/hooks/livekit/useChat';
import { useConnectionQuality } from '@/hooks/livekit/useConnectionQuality';
import { useMeetingStore } from '@/store/useMeetingStore';
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
  XCircle,
  LayoutGrid,
  Maximize2,
  Columns,
  Presentation,
  Tv2,
  Layers,
} from 'lucide-react';
import LayoutManager from './layout/LayoutManager';

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
    layoutMode,
    setLayoutMode,
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
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
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
  // Screen shares are handled dynamically inside LayoutManager
  const getIsHost = () => {
    try {
      const metaStr = room.localParticipant?.metadata;
      if (metaStr) {
        const meta = JSON.parse(metaStr);
        console.log("Participant Meta:", meta);
        const role = meta.user?.role || meta.participant?.role;
        return role === 'MENTOR' || role === 'ADMIN';
      }
    } catch (err) {
      console.error('Error parsing participant metadata:', err);
    }
    return false;
  };

  const isHost = getIsHost();

  const handleLeaveConfirm = () => {
    room.disconnect();
    toast.info('Left the meeting');
    router.push('/');
  };
  const handleEndMeeting = async () => {
    if (confirm("Are you sure you want to end the meeting for everyone?")) {
      try {
        const res = await fetch("/api/private/meet/end-meet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomId }),
        });

        if (res.ok) {
          toast.success("Meeting ended successfully");
          room.disconnect();
          router.push("/");
        } else {
          toast.error("Failed to end meeting");
        }
      } catch (err) {
        console.error("Error ending meeting:", err);
        toast.error("Error ending meeting");
      }
    }
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

        <div className="flex items-center gap-2">
          {/* End Meeting for Host */}
          {isHost && (
            <button
              onClick={handleEndMeeting}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white border border-red-700 py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>End Meeting</span>
            </button>
          )}

          {/* Leave */}
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-1.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Grid + Sidebar Container */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden relative">
          
          {/* Waiting for remote participant */}
          {remoteParticipants.length === 0 ? (
            <WaitingState roomId={roomId} />
          ) : (
            /* Google Meet-Style Dynamic Layout Engine */
            <LayoutManager
              updateKey={updateKey}
              localParticipant={localParticipant}
              remoteParticipants={remoteParticipants}
              activeSpeaker={activeSpeaker}
            />
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

          {/* Layout Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className={`p-3.5 rounded-xl transition-all border ${
                showLayoutMenu
                  ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
                  : 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
              }`}
              title="Change Layout"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            
            {showLayoutMenu && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 bg-brand-surface/95 backdrop-blur-xl border border-brand-border p-2 rounded-2xl shadow-2xl z-30 flex flex-col gap-1 animate-scale-in">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-extrabold text-brand-text-secondary text-left">
                  Choose Layout
                </div>
                {[
                  { mode: 'grid', label: 'Grid View', icon: LayoutGrid },
                  { mode: 'spotlight', label: 'Spotlight', icon: Maximize2 },
                  { mode: 'sidebar', label: 'Sidebar View', icon: Columns },
                  { mode: 'presenter', label: 'Presenter View', icon: Presentation },
                  { mode: 'content-first', label: 'Content First', icon: Tv2 },
                  { mode: 'pip', label: 'Floating PiP', icon: Layers },
                ].map((option) => {
                  const Icon = option.icon;
                  const isSelected = layoutMode === option.mode;
                  return (
                    <button
                      key={option.mode}
                      onClick={() => {
                        setLayoutMode(option.mode as 'grid' | 'spotlight' | 'sidebar' | 'presenter' | 'content-first' | 'pip');
                        setShowLayoutMenu(false);
                        toast.success(`Switched to ${option.label}`);
                      }}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-brand-orange text-white'
                          : 'text-brand-text-primary hover:bg-brand-border hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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
