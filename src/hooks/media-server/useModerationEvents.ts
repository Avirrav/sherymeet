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
    // Track previous permission state to detect grants (not just revokes)
    let prevCanMic = canParticipantUseMicrophone(room.localParticipant);
    let prevCanCam = canParticipantUseCamera(room.localParticipant);
    let prevCanScreen = canParticipantShareScreen(room.localParticipant);

    const syncPermissions = () => {
      const state = useMeetingStore.getState();
      const canMic = canParticipantUseMicrophone(room.localParticipant);
      const canCam = canParticipantUseCamera(room.localParticipant);
      const canScreen = canParticipantShareScreen(room.localParticipant);

      // Revoke permissions if no longer allowed
      if (!canMic) state.setAudioEnabled(false);
      if (!canCam) state.setVideoEnabled(false);
      if (!canScreen) state.toggleScreenShare(false);

      // Notify when permissions are granted (promoted to panelist)
      if (!prevCanCam && canCam) {
        toast.success("You can now share your camera!", {
          id: "panel-camera-granted",
          duration: 5000,
        });
      }
      if (!prevCanMic && canMic && !prevCanCam) {
        // Only show mic toast if camera wasn't also granted (avoid double toast)
        toast.success("You can now use your microphone!", {
          id: "panel-mic-granted",
          duration: 5000,
        });
      }

      // Update previous state
      prevCanMic = canMic;
      prevCanCam = canCam;
      prevCanScreen = canScreen;
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
