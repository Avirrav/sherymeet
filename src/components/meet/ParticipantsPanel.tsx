"use client";

import React from "react";
import ParticipantModerationControls from "./ParticipantModerationControls";
import {
  X,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Hand,
} from "lucide-react";
import { Room, Participant } from "livekit-client";
import { useParticipants } from "@/hooks/media-server/useParticipants";
import { useConnectionQuality } from "@/hooks/media-server/useConnectionQuality";
import { useMeetingStore } from "@/store/useMeetingStore";
import { getParticipantRoleLabel } from "./participant-permissions";

interface ParticipantsPanelProps {
  room: Room;
  onClose: () => void;
}

export default function ParticipantsPanel({ room, onClose }: ParticipantsPanelProps) {
  const { localParticipant, remoteParticipants } = useParticipants(room);
  const qualities = useConnectionQuality(room);
  const raisedHands = useMeetingStore((state) => state.raisedHands);

  const allParticipants = [...(localParticipant ? [localParticipant] : []), ...remoteParticipants];

  const renderQuality = (participant: Participant) => {
    const quality = qualities[participant.identity] || participant.connectionQuality;
    const size = "w-3.5 h-3.5";
    if (quality === "excellent" || quality === "good") {
      return <SignalHigh className={`${size} text-green-500`} />;
    }
    if (quality === "poor") {
      return <SignalLow className={`${size} text-md-error`} />;
    }
    return <SignalMedium className={`${size} text-yellow-500`} />;
  };

  return (
    <div className="w-80 h-full bg-md-surface-container-low border border-md-outline-variant/40 rounded-md-lg flex flex-col justify-between relative z-20">
      {/* Header */}
      <div className="p-4 border-b border-md-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-md-primary" />
          <h4 className="font-bold text-md-on-surface text-sm uppercase tracking-wider">
            Participants ({allParticipants.length})
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-md-outline-variant rounded-lg text-md-on-surface-variant hover:text-md-on-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {allParticipants.map((p) => {
          const isLocal = p.identity === room.localParticipant.identity;
          const isMuted = !p.isMicrophoneEnabled;
          const isCamOff = !p.isCameraEnabled;
          const hasHandRaised = raisedHands.includes(p.identity);

          return (
            <div
              key={p.identity}
              className="flex items-center justify-between p-3 bg-md-surface-container border border-md-outline-variant/40 hover:border-md-outline rounded-md-md transition-all"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                {/* Mini Avatar */}
                <div className="w-8 h-8 rounded-full bg-md-primary/15 border border-md-primary/30 flex items-center justify-center text-md-primary font-bold text-xs flex-shrink-0">
                  {(p.name || p.identity || "P").charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-md-on-surface truncate">
                    {p.name || p.identity}
                    {isLocal && (
                      <span className="text-md-primary text-[9px] font-black ml-1 uppercase">
                        (You)
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-md-on-surface-variant">
                    {getParticipantRoleLabel(p)}
                  </span>
                  <ParticipantModerationControls room={room} participant={p} />
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-2">
                {hasHandRaised && <Hand className="w-3.5 h-3.5 text-md-primary animate-bounce" />}
                <div className="flex items-center gap-1.5 bg-md-surface border border-md-outline-variant px-2 py-1 rounded-lg">
                  {isMuted ? (
                    <MicOff className="w-3 h-3 text-md-error" />
                  ) : (
                    <Mic className="w-3 h-3 text-md-on-surface-variant" />
                  )}
                  {isCamOff ? (
                    <VideoOff className="w-3 h-3 text-md-error" />
                  ) : (
                    <Video className="w-3 h-3 text-md-on-surface-variant" />
                  )}
                  {renderQuality(p)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
