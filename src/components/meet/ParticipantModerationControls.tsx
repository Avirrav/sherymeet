"use client";

import { useRef, useState } from "react";
import { Room, Participant, Track } from "livekit-client";
import { toast } from "sonner";
import { MicOff, Mic, UserPlus, UserMinus, Loader2, ShieldOff } from "lucide-react";
import { useMeetingStore } from "@/store/useMeetingStore";
import { ParticipantRole } from "@/types/roles";
import {
  getParticipantRole,
  isCoHostOrAbove,
  canParticipantUseMicrophone,
} from "./participant-permissions";
import { requestParticipantUnmute } from "./unmute-requests";

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
    // Grant only microphone access before requesting consent. The backend
    // preserves the member's role and all role-specific media restrictions.
    if (!canParticipantUseMicrophone(participant)) {
      const response = await fetch(
        `/api/server/${encodeURIComponent(room.name)}/participants/microphone`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ identity: participant.identity }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.message || "Could not allow microphone access");
    }
    const result = await requestParticipantUnmute(room, participant.identity);
    if (result === "permission_required") {
      toast.info("Unmute request sent. Microphone permission is updating.");
    } else if (result === "already_unmuted") {
      toast.info("This member is already unmuted");
    } else {
      toast.success(
        result === "already_requested"
          ? "An unmute request is already pending"
          : "Unmute request sent",
      );
    }
  }

  async function revokeMicrophone() {
    // First mute the track if they're unmuted
    if (!muted && microphone?.trackSid) {
      const host = process.env.NEXT_PUBLIC_LIVEKIT_URL?.replace(/^wss:/, "https:").replace(
        /^ws:/,
        "http:",
      );
      if (host) {
        const { LiveKitAPI } = await import("livekit-server-sdk");
        const api = new LiveKitAPI({ host, token });
        await api.room.mutePublishedTrack(
          room.name,
          participant.identity,
          microphone.trackSid,
          true,
        );
      }
    }
    // Then revoke permission
    const response = await fetch(
      `/api/server/${encodeURIComponent(room.name)}/participants/microphone`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ identity: participant.identity, revoke: true }),
      },
    );
    const result = await response.json();
    if (!response.ok || !result.success)
      throw new Error(result.message || "Could not revoke microphone permission");
    toast.success("Microphone permission revoked");
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

  const iconBtnClass =
    "w-6 h-6 rounded-md flex items-center justify-center transition-colors disabled:opacity-40";

  const hasMicPermission = canParticipantUseMicrophone(participant);

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 text-md-on-surface-variant animate-spin" />
      ) : (
        <>
          {/* Ask to unmute - show when user doesn't have mic permission */}
          {!hasMicPermission && (
            <button
              type="button"
              disabled={pending}
              className={`${iconBtnClass} bg-md-surface-variant/50 hover:bg-md-primary/20 text-md-on-surface-variant hover:text-md-primary`}
              onClick={() => void run(requestUnmute)}
              title="Allow microphone"
            >
              <Mic className="w-3 h-3" />
            </button>
          )}
          {/* Mute - show when user is unmuted */}
          {!muted && (
            <button
              type="button"
              disabled={pending}
              className={`${iconBtnClass} bg-md-error/10 hover:bg-md-error/20 text-md-error`}
              onClick={() => void run(mute)}
              title="Mute"
            >
              <MicOff className="w-3 h-3" />
            </button>
          )}
          {/* Revoke mic permission - show in webinars when user has mic permission */}
          {webinar && hasMicPermission && !isCoHostOrAbove(participant) && (
            <button
              type="button"
              disabled={pending}
              className={`${iconBtnClass} bg-md-error/10 hover:bg-md-error/20 text-md-error`}
              onClick={() => void run(revokeMicrophone)}
              title="Revoke microphone permission"
            >
              <ShieldOff className="w-3 h-3" />
            </button>
          )}
          {/* Panel control - webinar only */}
          {webinar && !isCoHostOrAbove(participant) && (
            <button
              type="button"
              disabled={pending}
              className={`${iconBtnClass} ${
                onPanel
                  ? "bg-md-error/10 hover:bg-md-error/20 text-md-error"
                  : "bg-md-tertiary/10 hover:bg-md-tertiary/20 text-md-tertiary"
              }`}
              onClick={() => void run(changePanel)}
              title={onPanel ? "Remove from panel" : "Add to panel"}
            >
              {onPanel ? <UserMinus className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
            </button>
          )}
        </>
      )}
    </div>
  );
}
