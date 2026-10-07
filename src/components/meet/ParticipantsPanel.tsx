"use client";

import React, { useMemo, useState } from "react";
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
  Crown,
  Shield,
  Search,
} from "lucide-react";
import { Room, Participant } from "livekit-client";
import { useParticipants } from "@/hooks/media-server/useParticipants";
import { useConnectionQuality } from "@/hooks/media-server/useConnectionQuality";
import { useMeetingStore } from "@/store/useMeetingStore";
import { getParticipantRoleLabel, isCoHostOrAbove, isHostRole } from "./participant-permissions";
import { getAvatarUrl } from "@/lib/avatar";

interface ParticipantsPanelProps {
  room: Room;
  onClose: () => void;
}

export default function ParticipantsPanel({ room, onClose }: ParticipantsPanelProps) {
  const { localParticipant, remoteParticipants } = useParticipants(room);
  const qualities = useConnectionQuality(room);
  const raisedHands = useMeetingStore((state) => state.raisedHands);
  const raisedHandsSet = useMemo(() => new Set(raisedHands), [raisedHands]);
  const [searchQuery, setSearchQuery] = useState("");

  if (!isCoHostOrAbove(localParticipant)) return null;

  const allParticipants = [...(localParticipant ? [localParticipant] : []), ...remoteParticipants];

  const filteredParticipants = searchQuery.trim()
    ? allParticipants.filter((p) => {
        const name = (p.name || p.identity || "").toLowerCase();
        return name.includes(searchQuery.toLowerCase().trim());
      })
    : allParticipants;

  const renderQuality = (participant: Participant) => {
    const quality = qualities[participant.identity] || participant.connectionQuality;
    const size = "w-3 h-3";
    if (quality === "excellent" || quality === "good") {
      return <SignalHigh className={`${size} text-md-tertiary`} />;
    }
    if (quality === "poor") {
      return <SignalLow className={`${size} text-md-error`} />;
    }
    return <SignalMedium className={`${size} text-yellow-500`} />;
  };

  const getRoleIcon = (participant: Participant) => {
    if (isHostRole(participant)) {
      return <Crown className="w-3 h-3 text-yellow-500" />;
    }
    if (isCoHostOrAbove(participant) && !isHostRole(participant)) {
      return <Shield className="w-3 h-3 text-md-primary" />;
    }
    return null;
  };

  return (
    <div className="w-80 h-full bg-md-surface-container-low border border-md-outline-variant/30 rounded-2xl flex flex-col overflow-hidden relative z-20">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-md-outline-variant/30 bg-md-surface-container/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-md-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-md-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-md-on-surface text-sm">Participants</h4>
              <p className="text-[10px] text-md-on-surface-variant">
                {allParticipants.length} in this meeting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-md-surface-variant/50 rounded-lg text-md-on-surface-variant hover:text-md-on-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-md-on-surface-variant" />
          <input
            type="text"
            placeholder="Search participants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs bg-md-surface-container border border-md-outline-variant/30 rounded-lg text-md-on-surface placeholder:text-md-on-surface-variant/60 focus:outline-none focus:border-md-primary/50 focus:ring-1 focus:ring-md-primary/20 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {filteredParticipants.length === 0 && searchQuery.trim() && (
          <div className="text-center py-6 text-md-on-surface-variant text-xs">
            No participants found matching &ldquo;{searchQuery}&rdquo;
          </div>
        )}
        {filteredParticipants.map((p) => {
          const isLocal = p.identity === room.localParticipant.identity;
          const isMuted = !p.isMicrophoneEnabled;
          const isCamOff = !p.isCameraEnabled;
          const hasHandRaised = raisedHandsSet.has(p.identity);
          const roleIcon = getRoleIcon(p);

          return (
            <div
              key={p.identity}
              className={`p-2.5 rounded-xl transition-colors ${
                hasHandRaised
                  ? "bg-md-primary/5 border border-md-primary/20"
                  : "bg-md-surface-container border border-md-outline-variant/30 hover:border-md-outline-variant/60"
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={getAvatarUrl(p.name, p.identity)}
                    alt={p.name || p.identity || "Participant"}
                    className={`w-8 h-8 rounded-full ${isLocal ? "ring-2 ring-md-primary" : ""}`}
                  />
                  {hasHandRaised && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-md-primary flex items-center justify-center animate-bounce">
                      <Hand className="w-2 h-2 text-md-on-primary" />
                    </div>
                  )}
                </div>

                {/* Name & Role */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-md-on-surface truncate">
                      {p.name || p.identity}
                    </span>
                    {isLocal && (
                      <span className="text-[8px] font-semibold text-md-primary bg-md-primary/10 px-1 py-0.5 rounded">
                        You
                      </span>
                    )}
                    {roleIcon}
                  </div>
                  <span className="text-[9px] text-md-on-surface-variant">
                    {getParticipantRoleLabel(p)}
                  </span>
                </div>

                {/* Status Icons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center ${
                      isMuted ? "bg-md-error/10" : "bg-md-surface-variant/50"
                    }`}
                  >
                    {isMuted ? (
                      <MicOff className="w-2.5 h-2.5 text-md-error" />
                    ) : (
                      <Mic className="w-2.5 h-2.5 text-md-on-surface-variant" />
                    )}
                  </div>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center ${
                      isCamOff ? "bg-md-error/10" : "bg-md-surface-variant/50"
                    }`}
                  >
                    {isCamOff ? (
                      <VideoOff className="w-2.5 h-2.5 text-md-error" />
                    ) : (
                      <Video className="w-2.5 h-2.5 text-md-on-surface-variant" />
                    )}
                  </div>
                  <div className="w-5 h-5 rounded flex items-center justify-center bg-md-surface-variant/50">
                    {renderQuality(p)}
                  </div>
                </div>

                {/* Moderation Controls - inline */}
                <ParticipantModerationControls room={room} participant={p} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
