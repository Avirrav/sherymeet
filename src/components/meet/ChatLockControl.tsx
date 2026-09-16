"use client";

import { useState } from "react";
import { Room, ConnectionState } from "livekit-client";
import { toast } from "sonner";
import { useMeetingStore } from "@/store/useMeetingStore";

export default function ChatLockControl({ room }: { room: Room }) {
  const { chatEnabled, token } = useMeetingStore();
  const [pending, setPending] = useState(false);
  const update = async () => {
    if (pending) return;
    setPending(true);
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
      setPending(false);
    }
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={chatEnabled}
      aria-label="Allow participants to chat"
      disabled={pending || room.state !== ConnectionState.Connected}
      onClick={update}
      className="mx-4 mb-3 px-3 py-2 rounded-xl border border-md-outline-variant text-xs text-md-on-surface disabled:opacity-50"
    >
      {pending ? "Updating chat..." : `Participant chat: ${chatEnabled ? "On" : "Off"}`}
    </button>
  );
}
