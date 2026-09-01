import { useState, useCallback, useEffect } from "react";
import { Room, RoomEvent, LocalTrackPublication } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { toAppError } from "@/server/types/error-types";
import { canParticipantPublish } from "@/features/meet/participant-permissions";

export function useScreenShare(room: Room | null) {
  const { isScreenSharing, toggleScreenShare } = useMeetingStore();
  const [screenSharePublication, setScreenSharePublication] =
    useState<LocalTrackPublication | null>(null);
  // Mirrors the token grant: webinar attendees cannot publish anything.
  const canShare = !room || canParticipantPublish(room.localParticipant);

  const startScreenShare = useCallback(async () => {
    if (!room) return;
    if (!canParticipantPublish(room.localParticipant)) {
      toast.info("Screen sharing is not allowed without host permission in this meeting.");
      return;
    }
    try {
      const pub = await room.localParticipant.setScreenShareEnabled(true, {
        audio: true, 
      });
      setScreenSharePublication(pub || null);
      toggleScreenShare(true);
      toast.success("Screen sharing started");
    } catch (unknownErr) {
      const err = toAppError(unknownErr);
      console.error("Failed to start screen share:", err);
      toggleScreenShare(false);
      toast.error(
        "Could not start screen sharing: " +
          (err.message || "Permission denied"),
      );
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
      console.error("Failed to stop screen share:", err.message);
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

    const handleLocalTrackUnpublished = (
      publication: LocalTrackPublication,
    ) => {
      if (
        publication.trackName === "screen_share" ||
        publication.source === "screen_share"
      ) {
        setScreenSharePublication(null);
        toggleScreenShare(false);
        toast.info("Screen sharing stopped from browser");
      }
    };

    room.localParticipant.on(
      RoomEvent.LocalTrackUnpublished,
      handleLocalTrackUnpublished,
    );

    return () => {
      room.localParticipant.off(
        RoomEvent.LocalTrackUnpublished,
        handleLocalTrackUnpublished,
      );
    };
  }, [room, toggleScreenShare]);

  return {
    isScreenSharing,
    toggleScreenShare: handleToggle,
    screenSharePublication,
    canShare,
  };
}
