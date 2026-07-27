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
    <div className="w-full max-w-md flex flex-col gap-4 p-6 rounded-2xl bg-md-surface-container/60 border border-md-outline-variant">
      {/* Primary CTA */}
      <button
        onClick={onStartInstantMeet}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 bg-md-primary hover:bg-md-primary-hover text-md-on-primary py-3.5 px-6 rounded-md-full font-medium disabled:opacity-50 group text-base cursor-pointer"
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
        <div className="flex-grow border-t border-md-outline-variant/60"></div>
        <span className="flex-shrink mx-4 text-xs uppercase tracking-wider text-md-on-surface-variant/60 font-semibold">
          Or join via code
        </span>
        <div className="flex-grow border-t border-md-outline-variant/60"></div>
      </div>

      {/* Join Form */}
      <form onSubmit={onJoinCustomRoom} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter room code (e.g. abc-defg-hij)"
          value={customRoomId}
          onChange={(e) => setCustomRoomId(e.target.value)}
          className="flex-1 bg-md-surface/80 border border-md-outline-variant focus:border-md-primary/50 px-4 py-3 rounded-xl text-md-on-surface text-sm outline-none transition-colors duration-200"
        />
        <button
          type="submit"
          className="bg-md-surface-container hover:bg-md-outline-variant border border-md-outline-variant hover:border-md-on-surface-variant/20 px-5 rounded-xl font-semibold transition-all duration-200 text-sm text-md-on-surface cursor-pointer"
        >
          Join
        </button>
      </form>
    </div>
  );
}
