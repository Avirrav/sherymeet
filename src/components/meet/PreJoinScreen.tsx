"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocalMedia } from "@/hooks/media-server/useLocalMedia";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { Video, VideoOff, Mic, MicOff, User, ArrowRight, ChevronDown, Loader2 } from "lucide-react";

interface PreJoinScreenProps {
  roomId: string;
  onJoin: (username: string) => void;
  userName?: string;
}

export default function PreJoinScreen({ roomId, onJoin, userName }: PreJoinScreenProps) {
  const { setUsername, audioEnabled, videoEnabled, audioDeviceId, videoDeviceId } =
    useMeetingStore();

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

  const [inputName, setInputName] = useState(userName || "");
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Derive loading state: video enabled but not yet rendering frames
  const isVideoLoading = videoEnabled && (!videoTrack || !isVideoReady);

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

  const handleVideoLoaded = useCallback(() => {
    setIsVideoReady(true);
  }, []);

  const handleToggleCamera = useCallback(() => {
    if (!videoEnabled) {
      setIsVideoReady(false);
    }
    toggleCamera();
  }, [videoEnabled, toggleCamera]);

  // Show toasts on permission failures
  useEffect(() => {
    if (isCameraPermissionDenied) {
      toast.warning("Camera access denied. Video will be unavailable.", {
        id: "cam-perm-warning",
      });
    }
  }, [isCameraPermissionDenied]);

  useEffect(() => {
    if (isMicPermissionDenied) {
      toast.warning("Microphone access denied. Audio will be unavailable.", {
        id: "mic-perm-warning",
      });
    }
  }, [isMicPermissionDenied]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setUsername(inputName.trim());
    onJoin(inputName.trim());
  };

  const initial = (inputName || userName || "You").trim().charAt(0).toUpperCase();

  const selectClass =
    "w-full appearance-none rounded-md-md bg-md-surface-container border border-md-outline-variant " +
    "px-4 py-3 pr-10 text-sm text-md-on-surface outline-none transition-colors " +
    "focus:border-md-primary disabled:opacity-50";

  return (
    <div className="relative min-h-screen bg-md-surface px-6 py-10 md:px-12 md:py-14  flex flex-col justify-center items-center animate-fade-in">
      <div className="w-full max-w-lg mx-auto">
        {/* Room identifier */}
        <div className="flex items-center gap-2.5 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-md-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-md-on-surface-variant">
            Room
          </span>
          <span className="text-md-outline">·</span>
          <span className="font-mono text-[13px] font-medium uppercase tracking-[0.12em] text-md-on-surface">
            {roomId}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-10 lg:gap-16 items-start">
          {/* ---------- Left: preview + device pickers ---------- */}
          <div className="flex flex-col gap-6">
            <div className="relative w-full aspect-video rounded-md-lg bg-md-surface-container-low border border-md-outline-variant overflow-hidden flex items-center justify-center">
              {videoEnabled && videoTrack ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedData={handleVideoLoaded}
                  className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-200 ${
                    isVideoLoading ? "opacity-0" : "opacity-100"
                  }`}
                />
              ) : (
                <div className="w-[128px] h-[128px] rounded-full bg-md-primary text-md-on-primary flex items-center justify-center">
                  <span className="font-display text-5xl font-bold leading-none">{initial}</span>
                </div>
              )}

              {/* Camera loading overlay */}
              {videoEnabled && isVideoLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-md-surface-container-low/80 backdrop-blur-sm z-10 transition-all">
                  <Loader2 className="w-8 h-8 text-md-primary animate-spin mb-3" />
                  <span className="text-xs text-md-on-surface-variant font-medium">
                    Starting camera...
                  </span>
                </div>
              )}

              {/* Live mic chip */}
              {audioEnabled && (
                <div className="absolute top-4 left-4 flex items-center gap-2 rounded-md-full bg-md-surface-container border border-md-outline-variant px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-md-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-md-on-surface-variant">
                    Live mic
                  </span>
                </div>
              )}

              {/* Media toggles */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  className={`control-btn w-12 h-12 rounded-full flex items-center justify-center border ${
                    audioEnabled
                      ? "bg-md-surface-container border-md-outline-variant text-md-on-surface hover:bg-md-surface-container-high"
                      : "bg-md-error-container border-transparent text-md-on-error-container"
                  }`}
                  title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                  {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={handleToggleCamera}
                  disabled={isVideoLoading}
                  className={`control-btn w-12 h-12 rounded-full flex items-center justify-center border transition-opacity ${
                    videoEnabled
                      ? "bg-md-surface-container border-md-outline-variant text-md-on-surface hover:bg-md-surface-container-high"
                      : "bg-md-error-container border-transparent text-md-on-error-container"
                  } ${isVideoLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                  title={videoEnabled ? "Turn off camera" : "Turn on camera"}
                >
                  {isVideoLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : videoEnabled ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <VideoOff className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
            {/* Device pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-md-on-surface-variant">
                  Camera
                </label>
                <div className="relative">
                  <select
                    value={videoDeviceId}
                    onChange={(e) => selectCamera(e.target.value)}
                    disabled={!videoEnabled}
                    className={selectClass}
                  >
                    {videoDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.substring(0, 4)}`}
                      </option>
                    ))}
                    {videoDevices.length === 0 && <option>No cameras found</option>}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-md-on-surface-variant" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-md-on-surface-variant">
                  Microphone
                </label>
                <div className="relative">
                  <select
                    value={audioDeviceId}
                    onChange={(e) => selectMicrophone(e.target.value)}
                    disabled={!audioEnabled}
                    className={selectClass}
                  >
                    {audioDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone ${d.deviceId.substring(0, 4)}`}
                      </option>
                    ))}
                    {audioDevices.length === 0 && <option>No microphones found</option>}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-md-on-surface-variant" />
                </div>
              </div>
            </div>
            {/* Start Button */}
            <div className="flex flex-col lg:pt-2">
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-md-on-surface-variant">
                    Your display name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-[18px] w-[18px] text-md-on-surface-variant" />
                    </span>
                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      disabled={!!userName}
                      readOnly={!!userName}
                      className={`w-full rounded-md-md bg-md-surface-container border border-md-outline-variant pl-12 pr-4 py-4 text-base text-md-on-surface outline-none transition-colors focus:border-md-primary ${
                        userName ? "opacity-60 cursor-not-allowed select-none" : ""
                      }`}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                  <button
                    type="submit"
                    className="btn-press group w-full flex items-center justify-center gap-2.5 rounded-md-full bg-md-primary hover:bg-md-primary-hover text-md-on-primary py-4 px-8 text-lg font-medium"
                  >
                    <span>Step into the room</span>
                    <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                  <p className="text-sm text-md-on-surface-variant">
                    Others will see you the moment you enter
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
