"use client";

import { useRef, useState } from "react";
import { Room, Participant, Track } from "livekit-client";
import { toast } from "sonner";
import { useMeetingStore } from "@/store/useMeetingStore";
import { ParticipantRole } from "@/types/roles";
import { getParticipantRole, isCoHostOrAbove } from "./participant-permissions";
import { REQUEST_UNMUTE } from "@/hooks/media-server/useModerationEvents";

export default function ParticipantModerationControls({
  room,
  participant,
}: {
  room: Room;
  participant: Participant;
}) {
  const token = useMeetingStore((s) => s.token);
  const webinar = useMeetingStore((s) => s.meetDetails?.type === "webinar");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  if (
    participant.identity === room.localParticipant.identity ||
    !isCoHostOrAbove(room.localParticipant)
  )
    return null;
  const onPanel = getParticipantRole(participant) === ParticipantRole.PANELIST;
  const microphone = participant.getTrackPublication(Track.Source.Microphone);
  const muted = !participant.isMicrophoneEnabled;

  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Moderation action failed");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function mute() {
    if (!microphone?.trackSid) throw new Error("This participant has no published microphone");
    const host = process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace(/^wss:/, "https:").replace(
      /^ws:/,
      "http:",
    );
    if (!host) throw new Error("LiveKit URL is unavailable");
    // Only a signed room token reaches the browser. LiveKit validates its
    // admin grant; no API key/secret or server config is imported here.
    const { LiveKitAPI } = await import("livekit-server-sdk");
    const api = new LiveKitAPI({ host, token });
    await api.room.mutePublishedTrack(room.name, participant.identity, microphone.trackSid, true);
    toast.success("Microphone muted");
  }

  async function requestUnmute() {
    await room.localParticipant.performRpc({
      destinationIdentity: participant.identity,
      method: REQUEST_UNMUTE,
      payload: "",
      responseTimeout: 5,
    });
    toast.success("Unmute request sent");
  }

  async function changePanel() {
    const response = await fetch(
      `/api/server/${encodeURIComponent(room.name)}/participants/panel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ identity: participant.identity, onPanel: !onPanel }),
      },
    );
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Panel change failed");
    toast.success(onPanel ? "Moved to audience" : "Added to panel");
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <button
        type="button"
        disabled={pending || participant.permissions?.canPublish === false}
        className="text-xs px-2 py-1 rounded border border-md-outline-variant disabled:opacity-40"
        onClick={() => void run(muted ? requestUnmute : mute)}
      >
        {muted ? "Ask to unmute" : "Mute"}
      </button>
      {webinar && !isCoHostOrAbove(participant) && (
        <button
          type="button"
          disabled={pending}
          className="text-xs px-2 py-1 rounded border border-md-outline-variant disabled:opacity-40"
          onClick={() => void run(changePanel)}
        >
          {onPanel ? "Remove from panel" : "Add to panel"}
        </button>
      )}
      {pending && (
        <span role="status" className="text-xs">
          Updating?
        </span>
      )}
    </div>
  );
}
