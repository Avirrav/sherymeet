import { useEffect } from "react";
import { Room, RoomEvent, Track, Participant, TrackPublication } from "livekit-client";
import { toast } from "sonner";
import { useMeetingStore } from "@/store/useMeetingStore";
import {
  canParticipantUseMicrophone,
  canParticipantUseCamera,
  canParticipantShareScreen,
} from "@/components/meet/participant-permissions";
import { registerUnmuteRequests } from "@/components/meet/unmute-requests";

// Permission signals and RPC requests can arrive in either order. Only wait
// after the participant clicks Unmute; the RPC handler still replies immediately.
function waitForMicrophonePermission(room: Room, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if (canParticipantUseMicrophone(room.localParticipant)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (allowed: boolean) => {
      clearTimeout(timeout);
      room.off(RoomEvent.ParticipantPermissionsChanged, checkPermission);
      signal.removeEventListener("abort", abort);
      resolve(allowed);
    };
    const checkPermission = () => {
      if (canParticipantUseMicrophone(room.localParticipant)) finish(true);
    };
    const abort = () => finish(false);
    const timeout = setTimeout(() => finish(false), 3000);
    room.on(RoomEvent.ParticipantPermissionsChanged, checkPermission);
    signal.addEventListener("abort", abort, { once: true });
    checkPermission();
  });
}

export function useModerationEvents(room: Room) {
  useEffect(() => {
    const controller = new AbortController();
    const requestToastId = `unmute:${room.name}`;
    const unregisterUnmute = registerUnmuteRequests(room, (caller) => {
      toast.info(`${caller.name || "Host"} asks you to unmute`, {
        id: requestToastId,
        duration: 15000,
        description: "Your microphone stays muted until you choose Unmute.",
        action: {
          label: "Unmute",
          onClick: async () => {
            const allowed = await waitForMicrophonePermission(room, controller.signal);
            if (controller.signal.aborted) return;
            if (allowed) {
              useMeetingStore.getState().setAudioEnabled(true);
            } else {
              toast.info("Microphone permission is not available yet. Ask the host to try again.");
            }
          },
        },
      });
    });
    const syncTrack = (publication: TrackPublication, participant?: Participant) => {
      if (participant && participant.identity !== room.localParticipant.identity) return;
      const state = useMeetingStore.getState();
      if (publication.source === Track.Source.Microphone)
        state.setAudioEnabled(
          canParticipantUseMicrophone(room.localParticipant) &&
            !publication.isMuted &&
            !!publication.track,
        );
      if (publication.source === Track.Source.Camera)
        state.setVideoEnabled(
          canParticipantUseCamera(room.localParticipant) &&
            !publication.isMuted &&
            !!publication.track,
        );
    };
    const syncPermissions = () => {
      const state = useMeetingStore.getState();
      if (!canParticipantUseMicrophone(room.localParticipant)) state.setAudioEnabled(false);
      if (!canParticipantUseCamera(room.localParticipant)) state.setVideoEnabled(false);
      if (!canParticipantShareScreen(room.localParticipant)) state.toggleScreenShare(false);
    };
    room.on(RoomEvent.TrackMuted, syncTrack);
    room.on(RoomEvent.TrackUnmuted, syncTrack);
    room.on(RoomEvent.ParticipantPermissionsChanged, syncPermissions);
    return () => {
      controller.abort();
      unregisterUnmute();
      toast.dismiss(requestToastId);
      room.off(RoomEvent.TrackMuted, syncTrack);
      room.off(RoomEvent.TrackUnmuted, syncTrack);
      room.off(RoomEvent.ParticipantPermissionsChanged, syncPermissions);
    };
  }, [room]);
}
