"use client";

import { useState } from "react";
import { Room, ConnectionState } from "livekit-client";
import { toast } from "sonner";
import { useMeetingStore } from "@/store/useMeetingStore";
import { Loader2, ChevronDown } from "lucide-react";

export default function ChatLockControl({ room }: { room: Room }) {
  const { chatEnabled, chatSlowModeSeconds, token } = useMeetingStore();
  const [pending, setPending] = useState<"lock" | "slow" | null>(null);

  const update = async () => {
    if (pending) return;
    setPending("lock");
    try {
      const response = await fetch(`/api/server/${encodeURIComponent(room.name)}/chat-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatEnabled: !chatEnabled }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || "Could not change chat");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change chat");
    } finally {
      setPending(null);
    }
  };

  const updateSlowMode = async (seconds: number) => {
    if (pending) return;
    setPending("slow");
    try {
      const response = await fetch(`/api/server/${encodeURIComponent(room.name)}/chat-slow-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ seconds }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || "Could not change slow mode");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change slow mode");
    } finally {
      setPending(null);
    }
  };

  const isDisabled = Boolean(pending) || room.state !== ConnectionState.Connected;

  return (
    <div className="flex-shrink-0 px-3 py-3 border-b border-md-outline-variant/30 space-y-3">
      {/* Chat Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-md-on-surface">Participant chat</span>
          {pending === "lock" && <Loader2 className="w-3 h-3 animate-spin text-md-primary" />}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={chatEnabled}
          aria-label="Allow participants to chat"
          disabled={isDisabled}
          onClick={update}
          className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            chatEnabled ? "bg-md-primary" : "bg-md-surface-variant"
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-[left] ${
              chatEnabled ? "left-5" : "left-1"
            }`}
          />
        </button>
      </div>

      {/* Slow Mode */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-md-on-surface">Slow mode</span>
          {pending === "slow" && <Loader2 className="w-3 h-3 animate-spin text-md-primary" />}
        </div>
        <div className="relative">
          <select
            value={chatSlowModeSeconds}
            disabled={isDisabled}
            onChange={(event) => updateSlowMode(Number(event.target.value))}
            className="appearance-none rounded-lg border border-md-outline-variant/50 bg-md-surface pl-3 pr-7 py-1.5 text-xs text-md-on-surface outline-none focus:border-md-primary disabled:opacity-50 cursor-pointer"
          >
            <option value={0}>Off</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-md-on-surface-variant pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
