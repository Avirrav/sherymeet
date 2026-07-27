'use client';

import React from 'react';
import { Copy, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface WaitingStateProps {
  roomId: string;
}

export default function WaitingState({ roomId }: WaitingStateProps) {
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room code copied');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-md-surface/40 relative">
      {/* Decorative spinning background lines */}
      <div className="absolute w-72 h-72 rounded-full border border-dashed border-md-primary/10 animate-spin pointer-events-none" style={{ animationDuration: '40s' }} />
      <div className="absolute w-96 h-96 rounded-full border border-dashed border-md-primary/5 animate-spin pointer-events-none" style={{ animationDuration: '60s', animationDirection: 'reverse' }} />

      <div className="relative z-10 w-full max-w-md bg-md-surface-container border border-md-outline-variant p-8 rounded-3xl flex flex-col items-center">
        
        {/* Animated Radar/User Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-md-primary/20 rounded-full animate-ping pointer-events-none" />
          <div className="w-16 h-16 rounded-full bg-md-primary/10 border border-md-primary/25 flex items-center justify-center text-md-primary relative z-10">
            <Users className="w-8 h-8" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-md-on-surface mb-2 tracking-wide">
          Waiting for someone to join...
        </h3>
        <p className="text-xs text-md-on-surface-variant mb-8 max-w-xs font-light">
          Share this secure room code with the person you want to meet with.
        </p>

        {/* Room Code Card */}
        <div className="w-full bg-md-surface border border-md-outline-variant p-4 rounded-2xl flex items-center justify-between gap-4 mb-4">
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[10px] text-md-on-surface-variant uppercase tracking-wider font-bold mb-0.5">
              Room Link Code
            </span>
            <span className="text-sm font-semibold text-md-on-surface truncate w-full tracking-wide">
              {roomId}
            </span>
          </div>

          <button
            onClick={handleCopyCode}
            className="p-2.5 bg-md-surface-container hover:bg-md-outline-variant border border-md-outline-variant hover:border-md-on-surface-variant/20 rounded-xl transition-all duration-200 text-md-on-surface hover:text-md-on-surface flex items-center justify-center flex-shrink-0 group active:scale-95"
            title="Copy Code"
          >
            <Copy className="w-4 h-4 transition-transform duration-200 group-hover:scale-105" />
          </button>
        </div>

        {/* Small loader info */}
        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-md-primary">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Active & Waiting</span>
        </div>

      </div>
    </div>
  );
}
