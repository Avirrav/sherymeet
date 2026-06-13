'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocalMedia } from '@/hooks/media-server/useLocalMedia';
import { useMeetingStore } from '@/store/useMeetingStore';
import { toast } from 'sonner';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  User,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface PreJoinScreenProps {
  roomId: string;
  onJoin: (username: string) => void;
  userName?: string;
}

export default function PreJoinScreen({ roomId, onJoin, userName }: PreJoinScreenProps) {
  const {
    setUsername,
    audioEnabled,
    videoEnabled,
    audioDeviceId,
    videoDeviceId,
  } = useMeetingStore();

  const {
    videoTrack,
    videoDevices,
    audioDevices,
    isCameraPermissionDenied,
    isMicPermissionDenied,
    startPreview,
    stopPreview,
    toggleCamera,
    toggleMicrophone,
    selectCamera,
    selectMicrophone,
  } = useLocalMedia();

  const [inputName, setInputName] = useState(userName || '');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync userName prop changes to local inputName state
  useEffect(() => {
    let active = true;
    if (userName) {
      Promise.resolve().then(() => {
        if (active) setInputName(userName);
      });
    }
    return () => {
      active = false;
    };
  }, [userName]);

  // Initialize media previews
  useEffect(() => {
    startPreview();
    return () => {
      stopPreview();
    };
  }, [startPreview, stopPreview]);

  // Attach local video track
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return;

    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  // Show toasts on permission failures
  useEffect(() => {
    if (isCameraPermissionDenied) {
      toast.warning('Camera access denied. Video will be unavailable.', {
        id: 'cam-perm-warning',
      });
    }
  }, [isCameraPermissionDenied]);

  useEffect(() => {
    if (isMicPermissionDenied) {
      toast.warning('Microphone access denied. Audio will be unavailable.', {
        id: 'mic-perm-warning',
      });
    }
  }, [isMicPermissionDenied]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    setUsername(inputName.trim());
    onJoin(inputName.trim());
  };

  return (
    <div className="relative min-h-screen bg-brand-dark flex flex-col justify-center items-center p-4 font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] aspect-square rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 bg-brand-surface border border-brand-border p-6 md:p-8 rounded-3xl glass-panel shadow-2xl">
        
        {/* Left Side: Video Preview Card (7 cols) */}
        <div className="md:col-span-7 flex flex-col justify-between gap-4">
          <h3 className="text-xl font-bold text-white tracking-wide">
            Room Code: <span className="text-brand-orange">{roomId}</span>
          </h3>

          {/* Local Feed Screen */}
          <div className="relative w-full aspect-video bg-black/40 border border-brand-border rounded-2xl overflow-hidden flex items-center justify-center">
            {videoEnabled && videoTrack ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-brand-text-secondary">
                <VideoOff className="w-12 h-12 text-brand-text-secondary/40" />
                <span className="text-xs">Camera is turned off</span>
              </div>
            )}

            {/* Quick action buttons overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button
                type="button"
                onClick={toggleMicrophone}
                className={`p-3 rounded-full transition-all duration-200 border ${
                  audioEnabled
                    ? 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
                    : 'bg-red-500/20 border-red-500/40 text-red-500 hover:bg-red-500/35'
                }`}
                title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                type="button"
                onClick={toggleCamera}
                className={`p-3 rounded-full transition-all duration-200 border ${
                  videoEnabled
                    ? 'bg-brand-surface hover:bg-brand-border text-white border-brand-border'
                    : 'bg-red-500/20 border-red-500/40 text-red-500 hover:bg-red-500/35'
                }`}
                title={videoEnabled ? 'Stop Video' : 'Start Video'}
              >
                {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>

            {/* Audio Indicator */}
            {audioEnabled && (
              <div className="absolute top-4 left-4 bg-brand-surface/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-brand-border flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-brand-orange animate-pulse" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-brand-orange">
                  Live Mic
                </span>
              </div>
            )}
          </div>

          {/* Dropdown Selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-text-secondary uppercase tracking-wider font-bold">
                Camera source
              </label>
              <select
                value={videoDeviceId}
                onChange={(e) => selectCamera(e.target.value)}
                disabled={!videoEnabled}
                className="bg-brand-dark border border-brand-border focus:border-brand-orange/50 px-3 py-2 rounded-xl text-xs text-white outline-none disabled:opacity-50 transition-colors"
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.substring(0, 4)}`}
                  </option>
                ))}
                {videoDevices.length === 0 && <option>No cameras found</option>}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-text-secondary uppercase tracking-wider font-bold">
                Microphone source
              </label>
              <select
                value={audioDeviceId}
                onChange={(e) => selectMicrophone(e.target.value)}
                disabled={!audioEnabled}
                className="bg-brand-dark border border-brand-border focus:border-brand-orange/50 px-3 py-2 rounded-xl text-xs text-white outline-none disabled:opacity-50 transition-colors"
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.substring(0, 4)}`}
                  </option>
                ))}
                {audioDevices.length === 0 && <option>No microphones found</option>}
              </select>
            </div>
          </div>
        </div>

        {/* Right Side: Identity Form (5 cols) */}
        <div className="md:col-span-5 flex flex-col justify-center border-t md:border-t-0 md:border-l border-brand-border/60 pt-6 md:pt-0 md:pl-8">
          <div className="mb-6">
            <div className="flex items-center gap-1.5 text-xs text-brand-orange font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ready to Join?</span>
            </div>
            <h2 className="text-2xl font-black text-white leading-tight">
              Pre-Join Setup
            </h2>
            <p className="text-xs text-brand-text-secondary mt-1">
              Configure your camera and name before connecting.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-text-secondary uppercase tracking-wider font-bold">
                Your Display Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-brand-text-secondary/50" />
                </span>
                <input
                  type="text"
                  placeholder="Enter username"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  disabled={!!userName}
                  readOnly={!!userName}
                  className={`w-full bg-brand-dark border border-brand-border focus:border-brand-orange/50 pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none transition-colors duration-200 ${
                    userName ? 'opacity-60 cursor-not-allowed select-none' : ''
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white py-3.5 px-6 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-brand-orange/20 hover:shadow-brand-orange/35 text-sm uppercase tracking-wider mt-2 group"
            >
              <span>Enter Meet</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
