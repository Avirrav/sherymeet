"use client";

import { useState } from "react";
import { Room, ConnectionState } from "livekit-client";
import { toast } from "sonner";
import { useMeetingStore } from "@/store/useMeetingStore";

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
      // RoomMetadataChanged supplies the authoritative state to every client.
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
  return (
    <div className="mx-4 mb-3 space-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={chatEnabled}
        aria-label="Allow participants to chat"
        disabled={Boolean(pending) || room.state !== ConnectionState.Connected}
        onClick={update}
        className="w-full px-3 py-2 rounded-xl border border-md-outline-variant text-xs text-md-on-surface disabled:opacity-50"
      >
        {pending === "lock"
          ? "Updating chat..."
          : `Participant chat: ${chatEnabled ? "On" : "Off"}`}
      </button>
      <label className="flex items-center justify-between gap-3 text-[10px] font-semibold text-md-on-surface-variant">
        Slow mode
        <select
          value={chatSlowModeSeconds}
          disabled={Boolean(pending) || room.state !== ConnectionState.Connected}
          onChange={(event) => updateSlowMode(Number(event.target.value))}
          className="rounded-lg border border-md-outline-variant bg-md-surface px-2 py-1.5 text-xs text-md-on-surface outline-none focus:border-md-primary/50 disabled:opacity-50"
        >
          <option value={0}>Off</option>
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option>
          <option value={30}>30 seconds</option>
          <option value={60}>60 seconds</option>
        </select>
      </label>
      {pending === "slow" && (
        <p role="status" className="text-[10px] text-md-on-surface-variant">
          Updating slow mode...
        </p>
      )}
    </div>
  );
}
