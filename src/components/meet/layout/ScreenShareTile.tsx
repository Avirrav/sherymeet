import React, { useEffect, useRef, useState, useCallback } from "react";
import { Track } from "livekit-client";
import { Maximize, Minimize, Volume2, VolumeX, PictureInPicture2 } from "lucide-react";

interface ScreenShareTileProps {
  track: Track;
  presenterName: string;
  presenterVideoTrack?: Track | null;
}

export const ScreenShareTile: React.FC<ScreenShareTileProps> = ({
  track,
  presenterName,
  presenterVideoTrack,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const presenterVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [isPiP, setIsPiP] = useState(false);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    track.attach(el);
    startTimeRef.current = Date.now();
    setDuration(0);

    return () => {
      track.detach(el);
    };
  }, [track]);

  // Attach presenter's video track for PiP overlay
  useEffect(() => {
    const el = presenterVideoRef.current;
    if (!el || !presenterVideoTrack) return;

    presenterVideoTrack.attach(el);

    return () => {
      presenterVideoTrack.detach(el);
    };
  }, [presenterVideoTrack]);

  // Update duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (startTimeRef.current > 0) {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format duration as MM:SS or HH:MM:SS
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Fullscreen toggle - fullscreens the container so watermark stays visible
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  // Toggle Picture-in-Picture
  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.error("PiP error:", err);
    }
  }, []);

  // Listen for PiP changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handlePiPChange = () => {
      setIsPiP(document.pictureInPictureElement === video);
    };
    video.addEventListener("enterpictureinpicture", handlePiPChange);
    video.addEventListener("leavepictureinpicture", handlePiPChange);
    return () => {
      video.removeEventListener("enterpictureinpicture", handlePiPChange);
      video.removeEventListener("leavepictureinpicture", handlePiPChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`group w-full h-full bg-black relative flex items-center justify-center border border-md-outline-variant overflow-hidden ${isFullscreen ? "rounded-none" : "rounded-2xl"}`}
    >
      {/* Video element - no native controls */}
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />

      {/* White watermark - stays visible in fullscreen */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white z-20 font-semibold tracking-wide pointer-events-none">
        {presenterName}&apos;s screen
      </div>

      {/* Presenter video PiP - shows in bottom-left during fullscreen */}
      {isFullscreen && presenterVideoTrack && (
        <div className="absolute bottom-20 left-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-30 bg-black">
          <video
            ref={presenterVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] text-white font-medium">
            {presenterName}
          </div>
        </div>
      )}

      {/* Custom controls bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="flex items-center justify-between">
          {/* Left side - Timer */}
          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-medium tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Right side - Controls */}
          <div className="flex items-center gap-2">
            {/* Volume */}
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* Picture-in-Picture */}
            {document.pictureInPictureEnabled && (
              <button
                onClick={togglePiP}
                className={`p-2 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer ${isPiP ? "bg-white/30" : ""}`}
                title={isPiP ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ScreenShareTile);
