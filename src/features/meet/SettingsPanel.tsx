'use client';

import React, { useState } from 'react';
import {
  X,
  Settings,
  LayoutGrid,
  Maximize2,
  Columns,
  Presentation,
  Tv2,
  Layers,
  Subtitles,
  Lock,
  Unlock,
  XCircle,
  LogOut,
} from 'lucide-react';
import { Room } from 'livekit-client';
import { useMeetingStore } from '@/store/useMeetingStore';
import { toast } from 'sonner';

interface SettingsPanelProps {
  room: Room;
  onClose: () => void;
  isHost: boolean;
  handleEndMeeting: () => void;
  setShowLeaveModal: (show: boolean) => void;
}

export default function SettingsPanel({
  room,
  onClose,
  isHost,
  handleEndMeeting,
  setShowLeaveModal,
}: SettingsPanelProps) {
  const {
    layoutMode,
    setLayoutMode,
    captionsEnabled,
    toggleCaptions,
  } = useMeetingStore();

  const [controlsLocked, setControlsLocked] = useState(true);

  return (
    <div className="w-80 h-full bg-brand-surface border-l border-brand-border rounded-xl flex flex-col justify-between animate-fade-in relative z-20">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-brand-orange" />
          <h4 className="font-bold text-white text-sm uppercase tracking-wider">
            Settings & Layout
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-brand-border rounded-lg text-brand-text-secondary hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Section 1: Choose Layout */}
        <div className='mt-2'>
          <div className="px-1 pb-2 text-[10px] uppercase tracking-wider font-extrabold text-brand-text-secondary text-left">
            Choose Layout
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { mode: 'grid', label: 'Grid View', icon: LayoutGrid },
              { mode: 'spotlight', label: 'Spotlight', icon: Maximize2 },
              { mode: 'sidebar', label: 'Sidebar View', icon: Columns },
              { mode: 'presenter', label: 'Presenter View', icon: Presentation },
              { mode: 'content-first', label: 'Content First', icon: Tv2 },
              { mode: 'pip', label: 'Floating PiP', icon: Layers },
            ].map((option) => {
              const Icon = option.icon;
              const isSelected = layoutMode === option.mode;
              return (
                <button
                  key={option.mode}
                  onClick={() => {
                    setLayoutMode(option.mode as 'grid' | 'spotlight' | 'sidebar' | 'presenter' | 'content-first' | 'pip');
                    toast.success(`Switched to ${option.label}`);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left w-full ${
                    isSelected
                      ? 'bg-brand-orange text-white'
                      : 'text-brand-text-primary hover:bg-brand-border hover:text-white bg-brand-dark/40 border border-brand-border/40'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-[1px] bg-brand-border" />

        {/* Section 2: General Settings */}
        <div className='mt-2'>
          <div className="px-1 pb-2 text-[10px] uppercase tracking-wider font-extrabold text-brand-text-secondary text-left">
            Transcription
          </div>
          <button
            onClick={() => {
              toggleCaptions();
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              captionsEnabled
                ? 'bg-brand-orange/10 text-brand-orange border-brand-orange/30'
                : 'text-brand-text-primary hover:bg-brand-border bg-brand-dark/40 border-brand-border/40'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Subtitles className="w-4 h-4" />
              <span>Live Captions (Transcribe)</span>
            </div>
            <span className="text-[10px] font-bold uppercase">
              {captionsEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        <div className="h-[1px] bg-brand-border" />

        {/* Section 3: Call Actions */}
        <div className='mt-2'>
          <div className="px-1 pb-2 text-[10px] uppercase tracking-wider font-extrabold text-brand-text-secondary text-left">
            Meeting Actions
          </div>
          <div className="flex flex-col gap-2">

            {/* Unlocked Controls */}

              <div className="flex flex-col gap-2 mt-1 animate-scale-in">
                {isHost && (
                  <button
                    onClick={() => {
                      onClose();
                      handleEndMeeting();
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white border border-red-700 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>End Meeting</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onClose();
                    setShowLeaveModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Leave Room</span>
                </button>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
