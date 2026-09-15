"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { Room } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";

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
  const { layoutMode, setLayoutMode, captionsEnabled, toggleCaptions, meetDetails } =
    useMeetingStore();

  const transcriptionAllowed = meetDetails?.isTranscription === true;

  const [controlsLocked, setControlsLocked] = useState(true);

  return (
    <div className="w-80 h-full bg-md-surface-container-low border border-md-outline-variant/40 rounded-md-lg flex flex-col justify-between relative z-20">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-md-primary" />
          <h4 className="font-bold text-md-on-surface text-sm uppercase tracking-wider">
            Settings & Layout
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-md-outline-variant rounded-lg text-md-on-surface-variant hover:text-md-on-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Section 1: Choose Layout */}
        <div className="mt-2">
          <div className="px-1 pb-2 text-[10px] uppercase tracking-wider font-extrabold text-md-on-surface-variant text-left">
            Choose Layout
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              { mode: "grid", label: "Grid View", icon: LayoutGrid },
              { mode: "spotlight", label: "Spotlight", icon: Maximize2 },
              { mode: "sidebar", label: "Sidebar View", icon: Columns },
              { mode: "presenter", label: "Presenter View", icon: Presentation },
              { mode: "content-first", label: "Content First", icon: Tv2 },
              { mode: "pip", label: "Floating PiP", icon: Layers },
            ].map((option) => {
              const Icon = option.icon;
              const isSelected = layoutMode === option.mode;
              return (
                <button
                  key={option.mode}
                  onClick={() => {
                    setLayoutMode(
                      option.mode as
                        "grid" | "spotlight" | "sidebar" | "presenter" | "content-first" | "pip",
                    );
                    toast.success(`Switched to ${option.label}`);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left w-full ${
                    isSelected
                      ? "bg-md-primary text-md-on-primary"
                      : "text-md-on-surface hover:bg-md-outline-variant hover:text-md-on-surface bg-md-surface/40 border border-md-outline-variant/40"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-[1px] bg-md-outline-variant" />

        {/* Section 2: General Settings */}
        <div className="mt-2">
          <div className="px-1 pb-2 text-[10px] uppercase tracking-wider font-extrabold text-md-on-surface-variant text-left">
            Transcription
          </div>
          <button
            onClick={() => {
              if (!transcriptionAllowed) return;
              toggleCaptions();
            }}
            disabled={!transcriptionAllowed}
            title={
              transcriptionAllowed
                ? "Toggle live captions"
                : "Transcription is disabled for this meeting"
            }
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              !transcriptionAllowed
                ? "opacity-50 cursor-not-allowed text-md-on-surface-variant bg-md-surface/40 border-md-outline-variant/40"
                : captionsEnabled
                  ? "bg-md-primary/10 text-md-primary border-md-primary/30"
                  : "text-md-on-surface hover:bg-md-outline-variant bg-md-surface/40 border-md-outline-variant/40"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Subtitles className="w-4 h-4" />
              <span>Live Captions (Transcribe)</span>
            </div>
            <span className="text-[10px] font-bold uppercase">
              {!transcriptionAllowed ? "UNAVAILABLE" : captionsEnabled ? "ON" : "OFF"}
            </span>
          </button>
        </div>

        <div className="h-[1px] bg-md-outline-variant" />

        {/* Section 3: Call Actions */}
        <div className="mt-2">
          <div className="px-1 pb-2 text-[10px] uppercase tracking-wider font-extrabold text-md-on-surface-variant text-left">
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
                  className="btn-press w-full flex items-center justify-center gap-2 bg-md-error hover:bg-md-error/90 text-md-on-error py-2.5 px-4 rounded-md-full text-xs font-medium cursor-pointer"
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
                className="btn-press md-state-layer w-full flex items-center justify-center gap-2 border border-md-error/50 text-md-error py-2.5 px-4 rounded-md-full text-xs font-medium cursor-pointer"
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
