import { useEffect } from "react";
import { Room, RoomEvent, Track, Participant, TrackPublication } from "livekit-client";
import { toast } from "sonner";
import { useMeetingStore } from "@/store/useMeetingStore";
import { canParticipantPublish, isCoHostOrAbove } from "@/components/meet/participant-permissions";

export const REQUEST_UNMUTE = "sherymeet.request-unmute";

export function useModerationEvents(room: Room) {
  useEffect(() => {
    let lastRequest = 0;
    const requestToastId = `unmute:${room.name}`;
    room.localParticipant.registerRpcMethod(REQUEST_UNMUTE, async ({ callerIdentity }) => {
      const caller = room.remoteParticipants.get(callerIdentity);
      if (!caller || !isCoHostOrAbove(caller)) throw new Error("Admin request required");
      if (!canParticipantPublish(room.localParticipant))
        throw new Error("Microphone permission required");
      if (Date.now() - lastRequest < 10000) return "already_requested";
      lastRequest = Date.now();
      toast.info(`${caller.name || "Host"} asks you to unmute`, {
        id: requestToastId,
        duration: 15000,
        action: {
          label: "Unmute",
          onClick: () => {
            if (canParticipantPublish(room.localParticipant)) {
              useMeetingStore.getState().setAudioEnabled(true);
            }
          },
        },
      });
      return "requested";
    });
    const syncTrack = (publication: TrackPublication, participant?: Participant) => {
      if (participant && participant.identity !== room.localParticipant.identity) return;
      const state = useMeetingStore.getState();
      if (publication.source === Track.Source.Microphone)
        state.setAudioEnabled(!publication.isMuted && !!publication.track);
      if (publication.source === Track.Source.Camera)
        state.setVideoEnabled(!publication.isMuted && !!publication.track);
    };
    const syncPermissions = () => {
      if (!canParticipantPublish(room.localParticipant)) {
        const state = useMeetingStore.getState();
        state.setAudioEnabled(false);
        state.setVideoEnabled(false);
        state.toggleScreenShare(false);
      }
    };
    room.on(RoomEvent.TrackMuted, syncTrack);
    room.on(RoomEvent.TrackUnmuted, syncTrack);
    room.on(RoomEvent.ParticipantPermissionsChanged, syncPermissions);
    return () => {
      room.localParticipant.unregisterRpcMethod(REQUEST_UNMUTE);
      toast.dismiss(requestToastId);
      room.off(RoomEvent.TrackMuted, syncTrack);
      room.off(RoomEvent.TrackUnmuted, syncTrack);
      room.off(RoomEvent.ParticipantPermissionsChanged, syncPermissions);
    };
  }, [room]);
}
