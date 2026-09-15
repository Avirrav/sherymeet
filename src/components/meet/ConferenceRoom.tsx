"use client";

import React, { useState, useEffect } from "react";
import { Room, ConnectionState } from "livekit-client";
import { useParticipants } from "@/hooks/media-server/useParticipants";
import { useScreenShare } from "@/hooks/media-server/useScreenShare";
import { useChat } from "@/hooks/media-server/useChat";
import { useMeetingStore } from "@/store/useMeetingStore";
import ChatPanel from "./ChatPanel";
import ReactionControls from "./ReactionControls";
import ReactionOverlay, { useReactionDisplay } from "./ReactionOverlay";
import ParticipantsPanel from "./ParticipantsPanel";
import SettingsPanel from "./SettingsPanel";
import LeaveConfirmModal from "./LeaveConfirmModal";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useModerationEvents } from "@/hooks/media-server/useModerationEvents";
import { useTranscribe } from "@/hooks/media-server/useTranscribe";
import CaptionOverlay from "./CaptionOverlay";
import MicVisualizer from "./MicVisualizer";
import RemoteParticipantAudio from "./RemoteParticipantAudio";
import { emitEmbedEvent, isEmbedded } from "./embed-bridge";
import {
  canParticipantUseMicrophone,
  canParticipantUseCamera,
  isPanelParticipant,
  canParticipantShareScreen,
  isHostRole,
  isCoHostOrAbove,
} from "./participant-permissions";

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
} from "lucide-react";
import LayoutManager from "./layout/LayoutManager";

interface ConferenceRoomProps {
  room: Room;
  isRecorder?: boolean;
}

export default function ConferenceRoom({ room, isRecorder = false }: ConferenceRoomProps) {
  const router = useRouter();
  const {
    roomId,
    token,
    audioEnabled,
    videoEnabled,
    toggleCamera,
    toggleMicrophone,
    activeSidebar,
    toggleSidebar,
    unreadChatCount,
    meetDetails,
  } = useMeetingStore();
  {
    /* Use Participants hook */
  }
  const { localParticipant, remoteParticipants, activeSpeaker, updateKey } = useParticipants(room);
  {
    /* Use ScreenShare hook */
  }
  const { isScreenSharing, toggleScreenShare } = useScreenShare(room);
  {
    /* Use Chat hook */
  }
  const { reactions, showReaction } = useReactionDisplay();
  const { raiseHand, isHandRaised, sendReaction } = useChat(room, showReaction);
  {
    /* Initialize and run the auto-transcription / live captions hook */
  }
  useTranscribe(room);
  useModerationEvents(room);
  {
    /* States */
  }
  const [duration, setDuration] = useState(0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  // Keeps the sidebar mounted briefly after close so it can slide out.
  const [renderedSidebar, setRenderedSidebar] = useState<typeof activeSidebar>(null);
  const isPanelClosing = !activeSidebar && !!renderedSidebar;
  useEffect(() => {
    if (activeSidebar) {
      // One-frame defer keeps the entrance animation reliable and avoids
      // synchronous setState inside the effect.
      const raf = requestAnimationFrame(() => setRenderedSidebar(activeSidebar));
      return () => cancelAnimationFrame(raf);
    }
    if (!renderedSidebar) return;
    const timer = setTimeout(() => setRenderedSidebar(null), 240);
    return () => clearTimeout(timer);
  }, [activeSidebar, renderedSidebar]);
  {
    /*Timer effect*/
  }
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  {
    /* Role comes from the token metadata, never from "is this me" */
  }
  const isHost = isHostRole(room.localParticipant);
  const isAdmin = isCoHostOrAbove(room.localParticipant);

  // Each media source has its own grant. Speaking does not require panel membership.
  const canUseMicrophone = canParticipantUseMicrophone(room.localParticipant);
  const canUseCamera = canParticipantUseCamera(room.localParticipant);
  const canShareScreen = canParticipantShareScreen(room.localParticipant);
  const isWebinar = meetDetails?.type === "webinar";
  const noPublishReason = isWebinar
    ? "Not allowed without host permission in this webinar"
    : "Not allowed without host permission";

  // Only hosts, co-hosts, and panelists have webinar tiles. Audience members
  // with microphone access are heard through separate audio-only elements.
  const stageParticipants = isWebinar
    ? remoteParticipants.filter(isPanelParticipant)
    : remoteParticipants;
  const stageLocalParticipant =
    isWebinar && !isPanelParticipant(localParticipant) ? null : localParticipant;
  const audienceAudio = isWebinar
    ? remoteParticipants
        .filter((participant) => !isPanelParticipant(participant))
        .map((participant) => (
          <RemoteParticipantAudio key={participant.identity} participant={participant} />
        ))
    : null;
  {
    /*Handle LeaveConfirm*/
  }
  const handleLeaveConfirm = () => {
    room.disconnect();
    toast.info("Left the meeting");
    // The embed bridge reports 'left' via the connection watcher in
    // MeetingPageClient; don't navigate away inside an embed iframe.
    if (!isEmbedded()) {
      router.push("/");
    }
  };
  {
    /*Handle EndMeeting*/
  }
  const handleEndMeeting = async () => {
    if (confirm("Are you sure you want to end the meeting for everyone?")) {
      try {
        const res = await fetch(`/api/server/${roomId}/end`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roomId, token }),
        });

        if (res.ok) {
          toast.success("Meeting ended successfully");
          room.disconnect();
          emitEmbedEvent("meeting-ended", { roomId });
          if (!isEmbedded()) {
            router.push("/");
          }
        } else {
          toast.error("Failed to end meeting");
        }
      } catch (err) {
        console.error("Error ending meeting:", err);
        toast.error("Error ending meeting");
      }
    }
  };

  if (isRecorder) {
    return (
      <div className="h-screen w-screen bg-md-surface text-md-on-surface overflow-hidden relative font-sans">
        {audienceAudio}
        <ReactionOverlay reactions={reactions} />
        <div className="w-full h-full flex overflow-hidden relative">
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <LayoutManager
              updateKey={updateKey}
              localParticipant={stageLocalParticipant}
              remoteParticipants={stageParticipants}
              activeSpeaker={activeSpeaker}
              emptyMessage={isWebinar ? "Waiting for the host to start presenting" : undefined}
            />
            <CaptionOverlay room={room} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col justify-between bg-md-surface text-md-on-surface overflow-hidden relative font-sans animate-screen-in">
      {audienceAudio}
      <ReactionOverlay reactions={reactions} />
      <header className="px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-md-on-surface-variant font-mono">
            <Clock className="w-3.5 h-3.5 text-md-primary" />
            <span>{formatDuration(duration)}</span>
          </div>
          <span className="text-md-outline-variant">|</span>
          <span className="text-xs font-semibold text-md-on-surface-variant font-mono tracking-wide">
            {roomId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Participants Sidebar Toggle */}
          {isAdmin && (
            <button
              onClick={() => toggleSidebar("participants")}
              className={`control-btn p-3.5 rounded-full border ${
                activeSidebar === "participants"
                  ? "bg-md-secondary-container text-md-on-secondary-container border-transparent"
                  : "bg-transparent border-transparent hover:bg-md-surface-container hover:border-md-outline-variant text-md-on-surface-variant hover:text-md-on-surface"
              }`}
              title="Participants Panel"
            >
              <Users className="w-5 h-5" />
            </button>
          )}

          {/* Chat Sidebar Toggle */}
          <button
            onClick={() => toggleSidebar("chat")}
            className={`control-btn p-3.5 rounded-full border relative ${
              activeSidebar === "chat"
                ? "bg-md-secondary-container text-md-on-secondary-container border-transparent"
                : "bg-transparent border-transparent hover:bg-md-surface-container hover:border-md-outline-variant text-md-on-surface-variant hover:text-md-on-surface"
            }`}
            title="Chat Panel"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && activeSidebar !== "chat" && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-md-primary border-2 border-md-surface flex items-center justify-center text-[9px] font-extrabold text-md-on-primary animate-scale-in">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Settings & Layout Sidebar Toggle */}
          <button
            onClick={() => toggleSidebar("settings")}
            className={`control-btn p-3.5 rounded-full border ${
              activeSidebar === "settings"
                ? "bg-md-secondary-container text-md-on-secondary-container border-transparent"
                : "bg-transparent border-transparent hover:bg-md-surface-container hover:border-md-outline-variant text-md-on-surface-variant hover:text-md-on-surface"
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
            localParticipant={stageLocalParticipant}
            remoteParticipants={stageParticipants}
            activeSpeaker={activeSpeaker}
            emptyMessage={isWebinar ? "Waiting for the host to start presenting" : undefined}
          />
          {/* Real-time Captions Overlay */}
          <CaptionOverlay room={room} />
        </div>
        {/* Sidebar panel (stays mounted during the slide-out animation) */}
        {renderedSidebar && (renderedSidebar !== "participants" || isAdmin) && (
          <div
            key={renderedSidebar}
            className={`h-full ${isPanelClosing ? "panel-slide-out" : "panel-slide-in"}`}
          >
            {renderedSidebar === "chat" && (
              <ChatPanel room={room} onClose={() => toggleSidebar("chat")} />
            )}
            {renderedSidebar === "participants" && isAdmin && (
              <ParticipantsPanel room={room} onClose={() => toggleSidebar("participants")} />
            )}
            {renderedSidebar === "settings" && (
              <SettingsPanel
                room={room}
                onClose={() => toggleSidebar("settings")}
                isHost={isHost}
                handleEndMeeting={handleEndMeeting}
                setShowLeaveModal={setShowLeaveModal}
              />
            )}
          </div>
        )}
      </div>

      {/* Controls Bar — M3 toolbar on a tonal surface container */}
      <footer className="mb-4 py-2 px-6 flex items-center justify-center z-10">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md-full bg-md-surface-container-high border border-md-outline-variant/40">
          <ReactionControls
            sendReaction={sendReaction}
            disabled={
              room.state !== ConnectionState.Connected ||
              room.localParticipant.permissions?.canPublishData === false
            }
          />
          {/* Raise Hand */}
          <button
            onClick={() => raiseHand(!isHandRaised)}
            disabled={remoteParticipants.length === 0}
            className={`control-btn p-3.5 rounded-full border disabled:opacity-30 disabled:pointer-events-none ${
              isHandRaised
                ? "bg-md-secondary-container text-md-on-secondary-container border-transparent"
                : "bg-transparent hover:bg-md-surface-container-highest text-md-on-surface-variant hover:text-md-on-surface border-transparent"
            }`}
            title="Raise Hand"
          >
            <Hand className="w-5 h-5" />
          </button>
          {/* Mute Mic */}
          <button
            onClick={toggleMicrophone}
            disabled={!canUseMicrophone}
            className={`control-btn p-3.5 rounded-full border disabled:opacity-30 disabled:pointer-events-none ${
              audioEnabled
                ? "bg-transparent hover:bg-md-surface-container-highest text-md-on-surface-variant hover:text-md-on-surface border-transparent"
                : "bg-md-error-container border-md-error/40 text-md-on-error-container hover:bg-md-error-container/80"
            }`}
            title={canUseMicrophone ? (audioEnabled ? "Mute Mic" : "Unmute Mic") : noPublishReason}
          >
            {audioEnabled ? (
              <Mic className="w-5 h-5 animate-pop-in" />
            ) : (
              <MicOff className="w-5 h-5 animate-pop-in" />
            )}
          </button>
          {/* Mic Sound Bar Visualizer */}
          <MicVisualizer isActive={audioEnabled} />
          {/* Toggle Camera */}
          <button
            onClick={toggleCamera}
            disabled={!canUseCamera}
            className={`control-btn p-3.5 rounded-full border disabled:opacity-30 disabled:pointer-events-none ${
              videoEnabled
                ? "bg-transparent hover:bg-md-surface-container-highest text-md-on-surface-variant hover:text-md-on-surface border-transparent"
                : "bg-md-error-container border-md-error/40 text-md-on-error-container hover:bg-md-error-container/80"
            }`}
            title={canUseCamera ? (videoEnabled ? "Stop Camera" : "Start Camera") : noPublishReason}
          >
            {videoEnabled ? (
              <VideoIcon className="w-5 h-5 animate-pop-in" />
            ) : (
              <VideoOff className="w-5 h-5 animate-pop-in" />
            )}
          </button>
          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            disabled={!canShareScreen || remoteParticipants.length === 0}
            className={`control-btn p-3.5 rounded-full border disabled:opacity-30 disabled:pointer-events-none ${
              isScreenSharing
                ? "bg-md-secondary-container text-md-on-secondary-container border-transparent"
                : "bg-transparent hover:bg-md-surface-container-highest text-md-on-surface-variant hover:text-md-on-surface border-transparent"
            }`}
            title={
              canShareScreen
                ? isScreenSharing
                  ? "Stop Screen Share"
                  : "Share Screen"
                : noPublishReason
            }
          >
            {isScreenSharing ? (
              <MonitorOff className="w-5 h-5 animate-pop-in" />
            ) : (
              <Monitor className="w-5 h-5 animate-pop-in" />
            )}
          </button>
        </div>
      </footer>

      {/* Attendee notice: publishing is denied by the meeting token */}
      {!canUseMicrophone && !canUseCamera && !canShareScreen && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full border border-md-outline-variant/60 text-[11px] text-md-on-surface-variant flex items-center gap-2 animate-fade-in-up">
          <MicOff className="w-3.5 h-3.5 text-md-primary" />
          <span>
            You&apos;re attending as a viewer. Microphone, camera, and screen share need host
            permission.
          </span>
        </div>
      )}

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
