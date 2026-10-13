import { useState, useCallback, useEffect } from "react";
import { Room, RoomEvent, LocalTrackPublication, Track } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { toAppError } from "@/types/error-types";
import { canParticipantShareScreen } from "@/components/meet/participant-permissions";

export function useScreenShare(room: Room | null) {
  const { isScreenSharing, toggleScreenShare } = useMeetingStore();
  const [screenSharePublication, setScreenSharePublication] =
    useState<LocalTrackPublication | null>(null);
  // Mirrors the token grant: webinar attendees cannot publish anything.
  const canShare = !room || canParticipantShareScreen(room.localParticipant);

  const startScreenShare = useCallback(async () => {
    if (!room) return;
    if (!canParticipantShareScreen(room.localParticipant)) {
      toast.info("Screen sharing is not allowed without host permission in this meeting.");
      return;
    }
    try {
      // Use createScreenTracks for proper audio support (per LiveKit docs)
      const tracks = await room.localParticipant.createScreenTracks({
        audio: true,
        // Request system audio for Chrome 105+
        systemAudio: "include",
        // Include current tab option for easier audio sharing
        selfBrowserSurface: "include",
        surfaceSwitching: "include",
      });

      // Publish all tracks (video and audio if user selected "Share tab audio")
      let videoPub: LocalTrackPublication | undefined;
      for (const track of tracks) {
        const pub = await room.localParticipant.publishTrack(track);
        if (track.kind === Track.Kind.Video) {
          videoPub = pub;
        }
      }

      setScreenSharePublication(videoPub || null);
      toggleScreenShare(true);

      const hasAudio = tracks.some((t) => t.kind === Track.Kind.Audio);
      if (hasAudio) {
        toast.success("Screen sharing started with audio");
      } else {
        toast.info(
          "Screen sharing started. To share audio, select a Browser Tab and check 'Share tab audio'",
        );
      }
    } catch (unknownErr) {
      const err = toAppError(unknownErr);
      toggleScreenShare(false);
      toast.error("Could not start screen sharing: " + (err.message || "Permission denied"));
    }
  }, [room, toggleScreenShare]);

  const stopScreenShare = useCallback(async () => {
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(false);
      setScreenSharePublication(null);
      toggleScreenShare(false);
      toast.success("Screen sharing stopped");
    } catch (unknownErr) {
      const err = toAppError(unknownErr);
      toast.error("Failed to stop screen sharing");
    }
  }, [room, toggleScreenShare]);

  const handleToggle = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  // Handle when screen sharing ends from browser control (e.g. Chrome's "Stop sharing" button)
  useEffect(() => {
    if (!room) return;

    const handleLocalTrackUnpublished = (publication: LocalTrackPublication) => {
      if (publication.trackName === "screen_share" || publication.source === "screen_share") {
        setScreenSharePublication(null);
        toggleScreenShare(false);
        toast.info("Screen sharing stopped from browser");
      }
    };

    room.localParticipant.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);

    return () => {
      room.localParticipant.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
    };
  }, [room, toggleScreenShare]);

  return {
    isScreenSharing,
    toggleScreenShare: handleToggle,
    screenSharePublication,
    canShare,
  };
}
