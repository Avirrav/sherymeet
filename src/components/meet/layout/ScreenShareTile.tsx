import React, { useEffect, useRef } from 'react';
import { Track } from 'livekit-client';

interface ScreenShareTileProps {
  track: Track;
  presenterName: string;
}

export const ScreenShareTile: React.FC<ScreenShareTileProps> = ({
  track,
  presenterName,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Attach the screen share track
    track.attach(el);

    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <div className="w-full h-full bg-black relative flex items-center justify-center border border-md-outline-variant rounded-2xl overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 text-xs text-md-on-surface z-10 font-semibold tracking-wide animate-scale-in">
        {presenterName}&apos;s screen
      </div>
    </div>
  );
};

export default React.memo(ScreenShareTile);
