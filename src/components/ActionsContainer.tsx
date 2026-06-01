import React from 'react';
import { Video, ArrowRight, Loader2 } from 'lucide-react';

interface ActionsContainerProps {
  isLoading: boolean;
  customRoomId: string;
  setCustomRoomId: (value: string) => void;
  onStartInstantMeet: () => void;
  onJoinCustomRoom: (e: React.FormEvent) => void;
}

export default function ActionsContainer({
  isLoading,
  customRoomId,
  setCustomRoomId,
  onStartInstantMeet,
  onJoinCustomRoom,
}: ActionsContainerProps) {
  return (
    <div className="w-full max-w-md flex flex-col gap-4 p-6 rounded-2xl bg-brand-surface/60 border border-brand-border glass-panel shadow-2xl">
      {/* Primary CTA */}
      <button
        onClick={onStartInstantMeet}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white py-3.5 px-6 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-brand-orange/20 hover:shadow-brand-orange/35 disabled:opacity-50 group text-base cursor-pointer"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Video className="w-5 h-5" />
            <span>Start Instant Meet</span>
            <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-200 group-hover:translate-x-1" />
          </>
        )}
      </button>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-brand-border/60"></div>
        <span className="flex-shrink mx-4 text-xs uppercase tracking-wider text-brand-text-secondary/60 font-semibold">
          Or join via code
        </span>
        <div className="flex-grow border-t border-brand-border/60"></div>
      </div>

      {/* Join Form */}
      <form onSubmit={onJoinCustomRoom} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter room code (e.g. abc-defg-hij)"
          value={customRoomId}
          onChange={(e) => setCustomRoomId(e.target.value)}
          className="flex-1 bg-brand-dark/80 border border-brand-border focus:border-brand-orange/50 px-4 py-3 rounded-xl text-white text-sm outline-none transition-colors duration-200"
        />
        <button
          type="submit"
          className="bg-brand-surface hover:bg-brand-border border border-brand-border hover:border-brand-text-secondary/20 px-5 rounded-xl font-semibold transition-all duration-200 text-sm text-brand-text-primary cursor-pointer"
        >
          Join
        </button>
      </form>
    </div>
  );
}
