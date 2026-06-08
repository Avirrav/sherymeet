'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Participant, Track, ParticipantEvent } from 'livekit-client';
import { Mic, MicOff, VideoOff, Hand, SignalHigh, SignalMedium, SignalLow, Pin } from 'lucide-react';
import { useMeetingStore } from '@/store/useMeetingStore';

interface ParticipantTileProps {
  participant: Participant;
  isLocal: boolean;
  className?: string;
  isSpeaker?: boolean;
  isVirtual?: boolean;
  pinned?: boolean;
  onPinToggle?: () => void;
}

export default function ParticipantTile({
  participant,
  isLocal,
  className = '',
  isSpeaker = false,
  isVirtual = false,
  pinned = false,
  onPinToggle,
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [videoTrack, setVideoTrack] = useState<Track | null>(null);
  const [audioTrack, setAudioTrack] = useState<Track | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(!participant.isMicrophoneEnabled);
  const [isVideoMuted, setIsVideoMuted] = useState(!participant.isCameraEnabled);
  
  const raisedHands = useMeetingStore((state) => state.raisedHands);
  const isHandRaised = raisedHands.includes(participant.identity);

  // Force re-renders when tracks change
  useEffect(() => {
    // Initial sync
    const syncTracks = () => {
      const vPub = Array.from(participant.videoTrackPublications.values()).find((pub) => pub.track);
      const aPub = Array.from(participant.audioTrackPublications.values()).find((pub) => pub.track);

      setVideoTrack(vPub?.track || null);
      setAudioTrack(aPub?.track || null);
      setIsAudioMuted(!participant.isMicrophoneEnabled);
      setIsVideoMuted(!participant.isCameraEnabled);
    };

    syncTracks();

    // Event listeners
    const handleTrackSubscribed = () => syncTracks();
    const handleTrackUnsubscribed = () => syncTracks();
    const handleTrackMuted = () => syncTracks();
    const handleTrackUnmuted = () => syncTracks();

    participant.on(ParticipantEvent.TrackSubscribed, handleTrackSubscribed);
    participant.on(ParticipantEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    participant.on(ParticipantEvent.TrackPublished, syncTracks);
    participant.on(ParticipantEvent.TrackUnpublished, syncTracks);
    participant.on(ParticipantEvent.TrackMuted, handleTrackMuted);
    participant.on(ParticipantEvent.TrackUnmuted, handleTrackUnmuted);
    participant.on(ParticipantEvent.IsSpeakingChanged, syncTracks);

    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, handleTrackSubscribed);
      participant.off(ParticipantEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      participant.off(ParticipantEvent.TrackPublished, syncTracks);
      participant.off(ParticipantEvent.TrackUnpublished, syncTracks);
      participant.off(ParticipantEvent.TrackMuted, handleTrackMuted);
      participant.off(ParticipantEvent.TrackUnmuted, handleTrackUnmuted);
      participant.off(ParticipantEvent.IsSpeakingChanged, syncTracks);
    };
  }, [participant]);

  // Handle video element binding
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack || isVirtual) return;

    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack, isVirtual]);

  // Handle audio element binding (remote only to avoid local echo)
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioTrack || isLocal) return;

    audioTrack.attach(el);
    return () => {
      audioTrack.detach(el);
    };
  }, [audioTrack, isLocal]);

  // Signal indicator helper
  const renderConnectionQuality = () => {
    const quality = participant.connectionQuality;
    const size = 'w-4 h-4';
    if (quality === 'excellent' || quality === 'good') {
      return <SignalHigh className={`${size} text-green-500`} />;
    }
    if (quality === 'poor') {
      return <SignalLow className={`${size} text-red-500`} />;
    }
    return <SignalMedium className={`${size} text-yellow-500`} />;
  };

  return (
    <div
      onDoubleClick={onPinToggle}
      className={`group relative w-full h-full bg-brand-surface rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
        isSpeaker ? 'border-brand-orange shadow-lg shadow-brand-orange/10' : 'border-brand-border'
      } ${className}`}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover rounded-2xl ${
          isLocal ? 'transform -scale-x-100' : ''
        } ${isVideoMuted || !videoTrack || isVirtual ? 'hidden' : ''}`}
      />

      {/* Avatar placeholder */}
      {(isVideoMuted || !videoTrack || isVirtual) && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-black/40 absolute inset-0">
          <div className="w-20 h-20 rounded-full bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center text-brand-orange font-bold text-3xl shadow-inner">
            {(participant.name || participant.identity || 'P').charAt(0).toUpperCase()}
          </div>
          {isVirtual && (
            <span className="text-[10px] text-brand-text-secondary mt-2">
              (Stream virtualized)
            </span>
          )}
        </div>
      )}

      {/* Audio element for remote tracks (always mounted, only active for remote tracks via ref attachment) */}
      <audio ref={audioRef} autoPlay className="hidden" />

      {/* Top Indicators Overlay */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        {/* Name and identity */}
        <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2 pointer-events-auto">
          <span className="text-xs font-semibold text-white">
            {participant.name || participant.identity}
            {isLocal && <span className="text-brand-orange ml-1 text-[10px] font-bold uppercase">(You)</span>}
          </span>
          {renderConnectionQuality()}
        </div>

        {/* Hand Raised and Pin overlay */}
        <div className="flex gap-2 items-center pointer-events-auto">
          {pinned && (
            <button
              onClick={onPinToggle}
              className="bg-brand-orange text-white p-1.5 rounded-lg flex items-center justify-center shadow-lg border border-brand-orange-hover hover:bg-brand-orange-hover transition-all cursor-pointer"
              title="Unpin Participant"
            >
              <Pin className="w-3.5 h-3.5 transform rotate-45" />
            </button>
          )}
          {!pinned && onPinToggle && (
            <button
              onClick={onPinToggle}
              className="bg-black/60 hover:bg-black/80 text-white/70 hover:text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center shadow-lg border border-white/5 transition-all cursor-pointer"
              title="Pin Participant"
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}
          {isHandRaised && (
            <div className="bg-brand-orange text-white p-1.5 rounded-lg flex items-center justify-center shadow-lg border border-brand-orange-hover animate-scale-in">
              <Hand className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom status indicators */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2">
        <div className={`p-2 rounded-full backdrop-blur-md border ${
          isAudioMuted
            ? 'bg-red-500/20 border-red-500/40 text-red-500'
            : 'bg-black/60 border-white/5 text-white'
        }`}>
          {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </div>
        {isVideoMuted && (
          <div className="p-2 rounded-full backdrop-blur-md border bg-red-500/20 border-red-500/40 text-red-500">
            <VideoOff className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}
