'use client';

import React, { useState, useEffect } from 'react';
import { Room } from 'livekit-client';
import { useParticipants } from '@/hooks/media-server/useParticipants';
import { useScreenShare } from '@/hooks/media-server/useScreenShare';
import { useChat } from '@/hooks/media-server/useChat';
import { useMeetingStore } from '@/store/useMeetingStore';
import ChatPanel from './ChatPanel';
import ParticipantsPanel from './ParticipantsPanel';
import SettingsPanel from './SettingsPanel';
import LeaveConfirmModal from './LeaveConfirmModal';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranscribe } from '@/hooks/media-server/useTranscribe';
import CaptionOverlay from './CaptionOverlay';
import MicVisualizer from './MicVisualizer';

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
  Clock,
  LayoutGrid,

} from 'lucide-react';
import LayoutManager from './layout/LayoutManager';
import { RoleHierarchy, UserRole } from '@/app/backend/interfaces/user-interface';

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
  {/* Use Participants hook */}
  const { localParticipant, remoteParticipants, activeSpeaker, updateKey } = useParticipants(room);
  {/* Use ScreenShare hook */}
  const { isScreenSharing, toggleScreenShare } = useScreenShare(room);
  {/* Use Chat hook */}
  const { raiseHand, isHandRaised } = useChat(room);
  {/* Initialize and run the auto-transcription / live captions hook */}
  useTranscribe(room);
  {/* States */}
  const [duration, setDuration] = useState(0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  {/*Timer effect*/}
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
  {/* Get IsHost */}
  const getIsHost = () => {
    try {
      const metaStr = room.localParticipant?.metadata;
      if (metaStr) {
        const meta = JSON.parse(metaStr);
        const role = meta.participant?.role as UserRole;
        return RoleHierarchy[role] >= RoleHierarchy[UserRole.MENTOR];
      }
    } catch (err) {
      console.error('Error parsing participant metadata:', err);
    }
    return false;
  };
  const isHost = getIsHost();
  {/*Handle LeaveConfirm*/}
  const handleLeaveConfirm = () => {
    room.disconnect();
    toast.info('Left the meeting');
    router.push('/');
  };
  {/*Handle EndMeeting*/}
  const handleEndMeeting = async () => {
    if (confirm("Are you sure you want to end the meeting for everyone?")) {
      try {
        const res = await fetch("/api/v1/client/meet/end-meet", {
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
  return (
    <div className="h-screen w-screen flex flex-col justify-between bg-brand-dark text-white overflow-hidden relative font-sans">
      <header className="px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-brand-text-secondary font-mono">
            <Clock className="w-3.5 h-3.5 text-brand-orange" />
            <span>{formatDuration(duration)}</span>
          </div>
          <span className="text-brand-border">|</span>
          <span className="text-xs font-semibold text-brand-text-secondary font-mono tracking-wide">
            {roomId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Participants Sidebar Toggle */}
          <button
            onClick={() => toggleSidebar('participants')}
            className={`p-3.5 rounded-full transition-all border ${
              activeSidebar === 'participants'
                ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
                : 'bg-transparent border-transparent hover:bg-brand-surface hover:border-brand-border text-brand-text-secondary hover:text-white'
            }`}
            title="Participants Panel"
          >
            <Users className="w-5 h-5" />
          </button>

          {/* Chat Sidebar Toggle */}
          <button
            onClick={() => toggleSidebar('chat')}
            className={`p-3.5 rounded-full transition-all border relative ${
              activeSidebar === 'chat'
                ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
                : 'bg-transparent border-transparent hover:bg-brand-surface hover:border-brand-border text-brand-text-secondary hover:text-white'
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

          {/* Settings & Layout Sidebar Toggle */}
          <button
            onClick={() => toggleSidebar('settings')}
            className={`p-3.5 rounded-full transition-all border ${
              activeSidebar === 'settings'
                ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
                : 'bg-transparent border-transparent hover:bg-brand-surface hover:border-brand-border text-brand-text-secondary hover:text-white'
            }`}
            title="Settings & Layout"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden relative mx-10">
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden relative">
            <LayoutManager
              updateKey={updateKey}
              localParticipant={localParticipant}
              remoteParticipants={remoteParticipants}
              activeSpeaker={activeSpeaker}
            />
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
        {activeSidebar === 'settings' && (
          <SettingsPanel
            room={room}
            onClose={() => toggleSidebar('settings')}
            isHost={isHost}
            handleEndMeeting={handleEndMeeting}
            setShowLeaveModal={setShowLeaveModal}
          />
        )}
      </div>

      {/* Controls Bar */}
      <footer className="mb-2 py-4 px-6 flex items-center justify-center gap-3.5 z-10">
        {/* Raise Hand */}
        <button
          onClick={() => raiseHand(!isHandRaised)}
          disabled={remoteParticipants.length === 0}
          className={`p-3.5 rounded-full transition-all border disabled:opacity-30 disabled:pointer-events-none ${
            isHandRaised
              ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
              : 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
          }`}
          title="Raise Hand"
        >
          <Hand className="w-5 h-5" />
        </button>
        {/* Mute Mic */}
        <button
          onClick={toggleMicrophone}
          className={`p-3.5 rounded-full transition-all border ${
            audioEnabled
              ? 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
              : 'bg-red-500/20 border-red-500/40 text-red-500 hover:bg-red-500/35'
          }`}
          title={audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
        >
          {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>
        {/* Mic Sound Bar Visualizer */}
        <MicVisualizer isActive={audioEnabled} />
        {/* Toggle Camera */}
        <button
          onClick={toggleCamera}
          className={`p-3.5 rounded-full transition-all border ${
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
          className={`p-3.5 rounded-full transition-all border disabled:opacity-30 disabled:pointer-events-none ${
            isScreenSharing
              ? 'bg-brand-orange hover:bg-brand-orange-hover text-white border-brand-orange'
              : 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
          }`}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>
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
