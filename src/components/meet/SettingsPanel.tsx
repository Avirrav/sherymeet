"use client";

import React from "react";
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
  XCircle,
  LogOut,
  Check,
  Sparkles,
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

type LayoutMode = "grid" | "spotlight" | "sidebar" | "presenter" | "content-first" | "pip";

const layoutOptions: { mode: LayoutMode; label: string; icon: typeof LayoutGrid }[] = [
  { mode: "grid", label: "Grid", icon: LayoutGrid },
  { mode: "spotlight", label: "Spotlight", icon: Maximize2 },
  { mode: "sidebar", label: "Sidebar", icon: Columns },
  { mode: "presenter", label: "Presenter", icon: Presentation },
  { mode: "content-first", label: "Content", icon: Tv2 },
  { mode: "pip", label: "PiP", icon: Layers },
];

export default function SettingsPanel({
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
    meetDetails,
    videoEnhancement,
    setVideoEnhancement,
  } = useMeetingStore();

  const transcriptionAllowed = meetDetails?.isTranscription === true;

  return (
    <div className="w-full md:w-80 h-full bg-md-surface-container-low border border-md-outline-variant/30 rounded-none md:rounded-2xl flex flex-col overflow-hidden relative z-20">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-md-outline-variant/30 flex items-center justify-between bg-md-surface-container/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-md-primary/10 flex items-center justify-center">
            <Settings className="w-4 h-4 text-md-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-md-on-surface text-sm">Settings</h4>
            <p className="text-[10px] text-md-on-surface-variant">Layout & preferences</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-md-surface-variant/50 rounded-lg text-md-on-surface-variant hover:text-md-on-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {/* Layout Section */}
        <div className="px-3 py-4">
          <span className="px-1 text-[10px] font-semibold text-md-on-surface-variant uppercase tracking-wide">
            Layout
          </span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {layoutOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = layoutMode === option.mode;
              return (
                <button
                  key={option.mode}
                  onClick={() => {
                    setLayoutMode(option.mode);
                    toast.success(`${option.label} view`);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                    isSelected
                      ? "bg-md-primary text-md-on-primary"
                      : "bg-md-surface-container border border-md-outline-variant/30 text-md-on-surface-variant hover:text-md-on-surface hover:border-md-outline-variant/60"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px mx-3 bg-md-outline-variant/30" />

        {/* Video Enhancement Section */}
        <div className="px-3 py-4">
          <span className="px-1 text-[10px] font-semibold text-md-on-surface-variant uppercase tracking-wide">
            Video
          </span>
          <button
            onClick={() => {
              setVideoEnhancement(!videoEnhancement);
              toast.success(videoEnhancement ? "Video enhancement off" : "Video enhancement on");
            }}
            className={`mt-2 w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
              videoEnhancement
                ? "bg-md-primary/10 border border-md-primary/30"
                : "bg-md-surface-container border border-md-outline-variant/30 hover:border-md-outline-variant/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  videoEnhancement ? "bg-md-primary/20" : "bg-md-surface-variant/50"
                }`}
              >
                <Sparkles
                  className={`w-4 h-4 ${videoEnhancement ? "text-md-primary" : "text-md-on-surface-variant"}`}
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-md-on-surface">Enhance Video</p>
                <p className="text-[10px] text-md-on-surface-variant">WebGL sharpening & clarity</p>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center ${
                videoEnhancement ? "bg-md-primary" : "bg-md-surface-variant"
              }`}
            >
              {videoEnhancement && <Check className="w-3 h-3 text-md-on-primary" />}
            </div>
          </button>
        </div>

        <div className="h-px mx-3 bg-md-outline-variant/30" />

        {/* Captions Section */}
        <div className="px-3 py-4">
          <span className="px-1 text-[10px] font-semibold text-md-on-surface-variant uppercase tracking-wide">
            Accessibility
          </span>
          <button
            onClick={() => {
              if (!transcriptionAllowed) return;
              toggleCaptions();
              toast.success(captionsEnabled ? "Captions off" : "Captions on");
            }}
            disabled={!transcriptionAllowed}
            className={`mt-2 w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
              !transcriptionAllowed
                ? "opacity-50 cursor-not-allowed bg-md-surface-container border border-md-outline-variant/30"
                : captionsEnabled
                  ? "bg-md-primary/10 border border-md-primary/30"
                  : "bg-md-surface-container border border-md-outline-variant/30 hover:border-md-outline-variant/60"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  captionsEnabled ? "bg-md-primary/20" : "bg-md-surface-variant/50"
                }`}
              >
                <Subtitles
                  className={`w-4 h-4 ${captionsEnabled ? "text-md-primary" : "text-md-on-surface-variant"}`}
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-md-on-surface">Live Captions</p>
                <p className="text-[10px] text-md-on-surface-variant">
                  {!transcriptionAllowed ? "Not available" : "Auto-transcribe speech"}
                </p>
              </div>
            </div>
            {transcriptionAllowed && (
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  captionsEnabled ? "bg-md-primary" : "bg-md-surface-variant"
                }`}
              >
                {captionsEnabled && <Check className="w-3 h-3 text-md-on-primary" />}
              </div>
            )}
          </button>
        </div>

        <div className="h-px mx-3 bg-md-outline-variant/30" />

        {/* Actions Section */}
        <div className="px-3 py-4">
          <span className="px-1 text-[10px] font-semibold text-md-on-surface-variant uppercase tracking-wide">
            Meeting
          </span>
          <div className="mt-2 space-y-2">
            <button
              onClick={() => {
                onClose();
                setShowLeaveModal(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-md-surface-container border border-md-outline-variant/30 hover:border-md-error/30 hover:bg-md-error/5 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-md-surface-variant/50 group-hover:bg-md-error/10 flex items-center justify-center transition-colors">
                <LogOut className="w-4 h-4 text-md-on-surface-variant group-hover:text-md-error transition-colors" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-md-on-surface group-hover:text-md-error transition-colors">
                  Leave Meeting
                </p>
                <p className="text-[10px] text-md-on-surface-variant">Exit this call</p>
              </div>
            </button>

            {isHost && (
              <button
                onClick={() => {
                  onClose();
                  handleEndMeeting();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-md-error/10 border border-md-error/20 hover:bg-md-error/20 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-md-error/20 flex items-center justify-center">
                  <XCircle className="w-4 h-4 text-md-error" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-md-error">End for Everyone</p>
                  <p className="text-[10px] text-md-on-surface-variant">Close the meeting</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
