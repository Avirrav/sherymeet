import React, { useEffect, useState } from 'react';
import { Room } from 'livekit-client';
import { useMeetingStore } from '@/store/useMeetingStore';

interface CaptionOverlayProps {
  room: Room | null;
}

interface CaptionItem {
  text: string;
  name: string;
  isLocal: boolean;
  timestamp: number;
}

export default function CaptionOverlay({ room }: CaptionOverlayProps) {
  const { captionsEnabled, transcriptions } = useMeetingStore();
  const [activeCaptions, setActiveCaptions] = useState<Record<string, CaptionItem>>({});

  // Sync state when transcriptions in the store change
  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;

      if (!captionsEnabled) {
        setActiveCaptions({});
        return;
      }

      const now = Date.now();
      setActiveCaptions((prev) => {
        const next = { ...prev };
        
        Object.entries(transcriptions).forEach(([identity, text]) => {
          // If empty transcription, skip/delete
          if (!text.trim()) {
            delete next[identity];
            return;
          }

          const isLocal = identity === room?.localParticipant?.identity;
          let name = 'Participant';
          if (isLocal) {
            name = 'You';
          } else {
            const remote = room?.remoteParticipants?.get(identity);
            name = remote?.name || remote?.identity || 'Remote Participant';
          }

          // Only update if text has changed or is new, to avoid resetting duration timer
          if (!prev[identity] || prev[identity].text !== text) {
            next[identity] = {
              text,
              name,
              isLocal,
              timestamp: now,
            };
          }
        });

        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [transcriptions, room, captionsEnabled]);

  // Periodically clean up stale captions (older than 4 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveCaptions((prev) => {
        let changed = false;
        const next = { ...prev };
        
        Object.entries(next).forEach(([identity, caption]) => {
          if (now - caption.timestamp > 4000) {
            delete next[identity];
            changed = true;
          }
        });
        
        return changed ? next : prev;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  if (!captionsEnabled) return null;

  const captionList = Object.entries(activeCaptions);
  if (captionList.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-2xl px-4 flex flex-col gap-2 pointer-events-none">
      {captionList.map(([identity, caption]) => (
        <div
          key={identity}
          className="glass-panel px-4 py-2.5 rounded-2xl flex flex-col gap-0.5 text-center animate-scale-in shadow-xl backdrop-blur-md"
          style={{ border: '1px solid rgba(255, 255, 255, 0.08)' }}
        >
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-brand-orange">
            {caption.name}
          </span>
          <p className="text-sm font-medium text-white leading-relaxed select-none">
            {caption.text}
          </p>
        </div>
      ))}
    </div>
  );
}
