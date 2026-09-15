"use client";

import React, { useState, useEffect } from "react";
import { Room } from "livekit-client";
import { useParticipants } from "@/hooks/media-server/useParticipants";
import { useScreenShare } from "@/hooks/media-server/useScreenShare";
import { useChat } from "@/hooks/media-server/useChat";
import { useMeetingStore } from "@/store/useMeetingStore";
import ChatPanel from "./ChatPanel";
import ParticipantsPanel from "./ParticipantsPanel";
import SettingsPanel from "./SettingsPanel";
import LeaveConfirmModal from "./LeaveConfirmModal";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useModerationEvents } from "@/hooks/media-server/useModerationEvents";
import { useTranscribe } from "@/hooks/media-server/useTranscribe";
import CaptionOverlay from "./CaptionOverlay";
import MicVisualizer from "./MicVisualizer";
import { emitEmbedEvent, isEmbedded } from "./embed-bridge";
import {
  canParticipantPublish,
  canParticipantShareScreen,
  isHostRole,
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
  const { raiseHand, isHandRaised } = useChat(room);
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

  // Publish rights come from the LiveKit token (webinar attendees are issued
  // canPublish: false). The server already rejects their publishes; disabling
  // the controls here just stops users from trying.
  const canPublish = canParticipantPublish(room.localParticipant);
  const isWebinar = meetDetails?.type === "webinar";
  const noPublishReason = isWebinar
    ? "Not allowed without host permission in this webinar"
    : "Not allowed without host permission";

  // In a webinar publishers (including panelists) appear on stage. Viewers never get
  // a tile (they appear in the participants panel instead), and their screen
  // shares are not staged either.
  const stageParticipants = isWebinar
    ? remoteParticipants.filter((p) => canParticipantPublish(p))
    : remoteParticipants;
  const stageLocalParticipant =
    isWebinar && !canParticipantPublish(localParticipant) ? null : localParticipant;
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
        {renderedSidebar && (
          <div
            key={renderedSidebar}
            className={`h-full ${isPanelClosing ? "panel-slide-out" : "panel-slide-in"}`}
          >
            {renderedSidebar === "chat" && (
              <ChatPanel room={room} onClose={() => toggleSidebar("chat")} />
            )}
            {renderedSidebar === "participants" && (
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
            disabled={!canPublish}
            className={`control-btn p-3.5 rounded-full border disabled:opacity-30 disabled:pointer-events-none ${
              audioEnabled
                ? "bg-transparent hover:bg-md-surface-container-highest text-md-on-surface-variant hover:text-md-on-surface border-transparent"
                : "bg-md-error-container border-md-error/40 text-md-on-error-container hover:bg-md-error-container/80"
            }`}
            title={canPublish ? (audioEnabled ? "Mute Mic" : "Unmute Mic") : noPublishReason}
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
            disabled={!canPublish}
            className={`control-btn p-3.5 rounded-full border disabled:opacity-30 disabled:pointer-events-none ${
              videoEnabled
                ? "bg-transparent hover:bg-md-surface-container-highest text-md-on-surface-variant hover:text-md-on-surface border-transparent"
                : "bg-md-error-container border-md-error/40 text-md-on-error-container hover:bg-md-error-container/80"
            }`}
            title={canPublish ? (videoEnabled ? "Stop Camera" : "Start Camera") : noPublishReason}
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
            disabled={
              !canParticipantShareScreen(localParticipant) || remoteParticipants.length === 0
            }
            className={`control-btn p-3.5 rounded-full border disabled:opacity-30 disabled:pointer-events-none ${
              isScreenSharing
                ? "bg-md-secondary-container text-md-on-secondary-container border-transparent"
                : "bg-transparent hover:bg-md-surface-container-highest text-md-on-surface-variant hover:text-md-on-surface border-transparent"
            }`}
            title={
              canPublish
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
      {!canPublish && (
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
