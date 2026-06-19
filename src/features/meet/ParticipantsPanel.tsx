'use client';

import React from 'react';
import { X, Users, Mic, MicOff, Video, VideoOff, SignalHigh, SignalMedium, SignalLow, Hand } from 'lucide-react';
import { Room, Participant } from 'livekit-client';
import { useParticipants } from '@/hooks/media-server/useParticipants';
import { useConnectionQuality } from '@/hooks/media-server/useConnectionQuality';
import { useMeetingStore } from '@/store/useMeetingStore';

interface ParticipantsPanelProps {
  room: Room;
  onClose: () => void;
}

export default function ParticipantsPanel({ room, onClose }: ParticipantsPanelProps) {
  const { localParticipant, remoteParticipants } = useParticipants(room);
  const qualities = useConnectionQuality(room);
  const raisedHands = useMeetingStore((state) => state.raisedHands);

  const allParticipants = [
    ...(localParticipant ? [localParticipant] : []),
    ...remoteParticipants,
  ];

  const renderQuality = (participant: Participant) => {
    const quality = qualities[participant.identity] || participant.connectionQuality;
    const size = 'w-3.5 h-3.5';
    if (quality === 'excellent' || quality === 'good') {
      return <SignalHigh className={`${size} text-green-500`} />;
    }
    if (quality === 'poor') {
      return <SignalLow className={`${size} text-red-500`} />;
    }
    return <SignalMedium className={`${size} text-yellow-500`} />;
  };

  return (
    <div className="w-80 h-full bg-brand-surface border-l border-brand-border rounded-xl flex flex-col justify-between animate-fade-in relative z-20">
      
      {/* Header */}
      <div className="p-4 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-orange" />
          <h4 className="font-bold text-white text-sm uppercase tracking-wider">
            Participants ({allParticipants.length})
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-brand-border rounded-lg text-brand-text-secondary hover:text-white transition-colors"
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
              className="flex items-center justify-between p-3 bg-brand-dark/40 border border-brand-border/60 hover:border-brand-border rounded-xl transition-all"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                {/* Mini Avatar */}
                <div className="w-8 h-8 rounded-full bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center text-brand-orange font-bold text-xs flex-shrink-0">
                  {(p.name || p.identity || 'P').charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate">
                    {p.name || p.identity}
                    {isLocal && (
                      <span className="text-brand-orange text-[9px] font-black ml-1 uppercase">
                        (You)
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] text-brand-text-secondary">
                    {isLocal ? 'Host' : 'Participant'}
                  </span>
                </div>
              </div>

              {/* Status Icons */}
              <div className="flex items-center gap-2">
                {hasHandRaised && (
                  <Hand className="w-3.5 h-3.5 text-brand-orange animate-bounce" />
                )}
                <div className="flex items-center gap-1.5 bg-brand-dark border border-brand-border px-2 py-1 rounded-lg">
                  {isMuted ? (
                    <MicOff className="w-3 h-3 text-red-500" />
                  ) : (
                    <Mic className="w-3 h-3 text-brand-text-secondary" />
                  )}
                  {isCamOff ? (
                    <VideoOff className="w-3 h-3 text-red-500" />
                  ) : (
                    <Video className="w-3 h-3 text-brand-text-secondary" />
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
