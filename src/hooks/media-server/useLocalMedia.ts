import { useState, useEffect, useCallback, useRef } from "react";
import {
  createLocalVideoTrack,
  createLocalAudioTrack,
  LocalVideoTrack,
  LocalAudioTrack,
  Room,
  VideoPresets,
} from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { toAppError } from "@/app/backend/types/error-types";

/**
 * Hook to manage local camera and microphone previews on the Pre-Join screen.
 * Consolidates all state updates into single sync hooks to prevent overlapping
 * hardware requests and permission race conditions.
 */
export function useLocalMedia() {
  const {
    audioEnabled,
    videoEnabled,
    audioDeviceId,
    videoDeviceId,
    setAudioEnabled,
    setVideoEnabled,
    setAudioDeviceId,
    setVideoDeviceId,
  } = useMeetingStore();

  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  const [isCameraPermissionDenied, setIsCameraPermissionDenied] =
    useState(false);
  const [isMicPermissionDenied, setIsMicPermissionDenied] = useState(false);

  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);

  const isStartingVideoRef = useRef(false);
  const isStartingAudioRef = useRef(false);

  // Load available media input devices
  const loadDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      console.warn("Media devices API is not supported in this browser context (unsecure connection).");
      return;
    }
    try {
      const vDevices = await Room.getLocalDevices("videoinput");
      const aDevices = await Room.getLocalDevices("audioinput");

      setVideoDevices(vDevices);
      setAudioDevices(aDevices);

      // Select default devices if not already set
      if (vDevices.length > 0 && !videoDeviceId) {
        setVideoDeviceId(vDevices[0].deviceId);
      }
      if (aDevices.length > 0 && !audioDeviceId) {
        setAudioDeviceId(aDevices[0].deviceId);
      }
    } catch (unknownErr) {
      const err = toAppError(unknownErr);
      console.error("Error listing devices:", err.message);
    }
  }, [videoDeviceId, audioDeviceId, setVideoDeviceId, setAudioDeviceId]);

  // Load devices list once on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDevices();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDevices]);

  // Sync Camera Track with preferences and device selection
  useEffect(() => {
    let active = true;

    const syncVideo = async () => {
      // 1. If camera is disabled, stop existing track and cleanup
      if (!videoEnabled) {
        if (videoTrackRef.current) {
          console.log("Stopping local video track preview...");
          videoTrackRef.current.stop();
          videoTrackRef.current = null;
          setVideoTrack(null);
        }
        return;
      }

      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        setIsCameraPermissionDenied(true);
        setVideoEnabled(false);
        setVideoTrack(null);
        toast.warning(
          "Camera access is not supported. Please ensure you are using a secure connection (HTTPS or localhost).",
          { id: "cam-perm-warning" }
        );
        return;
      }

      // Guard to prevent overlapping video track requests
      if (isStartingVideoRef.current) return;
      isStartingVideoRef.current = true;

      try {
        if (videoTrackRef.current) {
          videoTrackRef.current.stop();
          videoTrackRef.current = null;
        }

        console.log(
          "Creating local video track preview with HD resolution for device:",
          videoDeviceId,
        );
        const track = await createLocalVideoTrack({
          deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
          resolution: VideoPresets.h720.resolution, // Capture in HD quality (1280x720)
        });

        if (!active) {
          track.stop();
          return;
        }

        videoTrackRef.current = track;
        setVideoTrack(track);
        setIsCameraPermissionDenied(false);
      } catch (unknownErr) {
        // Fallback: If selected camera is in use or fails, try the next available camera!
        let otherCameras: MediaDeviceInfo[] = [];
        try {
          const vDevices = await Room.getLocalDevices("videoinput");
          otherCameras = vDevices.filter(
            (d) => d.deviceId !== videoDeviceId && d.deviceId !== "",
          );
        } catch (deviceErr) {
          console.error(
            "Failed to query video devices inside fallback:",
            deviceErr,
          );
        }

        if (otherCameras.length > 0) {
          console.warn(
            "Selected camera failed/busy. Trying fallback camera:",
            otherCameras[0].deviceId,
          );
          try {
            const fallbackTrack = await createLocalVideoTrack({
              deviceId: { exact: otherCameras[0].deviceId },
              resolution: VideoPresets.h720.resolution,
            });
            if (!active) {
              fallbackTrack.stop();
              return;
            }
            setVideoDeviceId(otherCameras[0].deviceId); // Sync selected device in meeting store
            videoTrackRef.current = fallbackTrack;
            setVideoTrack(fallbackTrack);
            setIsCameraPermissionDenied(false);
            toast.info(
              "Selected camera was busy/unavailable. Switched to another camera.",
              {
                id: "cam-fallback-info",
              },
            );
            return;
          } catch (fallbackErr) {
            console.error("Fallback camera also failed:", fallbackErr);
          }
        }

        if (!active) return;
        const err = toAppError(unknownErr);
        console.error("Error creating video track:", err.message);
        setIsCameraPermissionDenied(true);
        setVideoEnabled(false);
        setVideoTrack(null);

        // Use unique toast ID to prevent duplicate popups
        toast.warning("Camera permission denied or camera unavailable", {
          id: "cam-perm-warning",
        });
      } finally {
        isStartingVideoRef.current = false;
      }
    };

    syncVideo();

    return () => {
      active = false;
    };
  }, [videoEnabled, videoDeviceId, setVideoEnabled, setVideoDeviceId]);

  // Sync Microphone Track with preferences and device selection
  useEffect(() => {
    let active = true;

    const syncAudio = async () => {
      // 1. If microphone is disabled, stop existing track and cleanup
      if (!audioEnabled) {
        if (audioTrackRef.current) {
          console.log("Stopping local audio track preview...");
          audioTrackRef.current.stop();
          audioTrackRef.current = null;
          setAudioTrack(null);
        }
        return;
      }

      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        setIsMicPermissionDenied(true);
        setAudioEnabled(false);
        setAudioTrack(null);
        toast.warning(
          "Microphone access is not supported. Please ensure you are using a secure connection (HTTPS or localhost).",
          { id: "mic-perm-warning" }
        );
        return;
      }

      // Guard to prevent overlapping audio track requests
      if (isStartingAudioRef.current) return;
      isStartingAudioRef.current = true;

      try {
        if (audioTrackRef.current) {
          audioTrackRef.current.stop();
          audioTrackRef.current = null;
        }

        console.log(
          "Creating local audio track preview for device:",
          audioDeviceId,
        );
        const track = await createLocalAudioTrack({
          deviceId: audioDeviceId || undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        if (!active) {
          track.stop();
          return;
        }

        audioTrackRef.current = track;
        setAudioTrack(track);
        setIsMicPermissionDenied(false);
      } catch (unknownErr) {
        // Fallback: If selected microphone is busy/fails, try another available mic!
        let otherMics: MediaDeviceInfo[] = [];
        try {
          const aDevices = await Room.getLocalDevices("audioinput");
          otherMics = aDevices.filter(
            (d) => d.deviceId !== audioDeviceId && d.deviceId !== "",
          );
        } catch (deviceErr) {
          console.error(
            "Failed to query audio devices inside fallback:",
            deviceErr,
          );
        }

        if (otherMics.length > 0) {
          console.warn(
            "Selected microphone failed/busy. Trying fallback microphone:",
            otherMics[0].deviceId,
          );
          try {
            const fallbackTrack = await createLocalAudioTrack({
              deviceId: otherMics[0].deviceId,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            });
            if (!active) {
              fallbackTrack.stop();
              return;
            }
            setAudioDeviceId(otherMics[0].deviceId); // Sync in meeting store
            audioTrackRef.current = fallbackTrack;
            setAudioTrack(fallbackTrack);
            setIsMicPermissionDenied(false);
            toast.info(
              "Selected microphone was busy. Switched to another microphone.",
              {
                id: "mic-fallback-info",
              },
            );
            return;
          } catch (fallbackErr) {
            console.error("Fallback microphone also failed:", fallbackErr);
          }
        }

        if (!active) return;
        const err = toAppError(unknownErr);
        console.error("Error creating audio track:", err.message);
        setIsMicPermissionDenied(true);
        setAudioEnabled(false);
        setAudioTrack(null);

        // Use unique toast ID to prevent duplicate popups
        toast.warning(
          "Microphone permission denied or microphone unavailable",
          {
            id: "mic-perm-warning",
          },
        );
      } finally {
        isStartingAudioRef.current = false;
      }
    };

    syncAudio();

    return () => {
      active = false;
    };
  }, [audioEnabled, audioDeviceId, setAudioEnabled, setAudioDeviceId]);

  const toggleCamera = useCallback(() => {
    setVideoEnabled(!videoEnabled);
  }, [videoEnabled, setVideoEnabled]);

  const toggleMicrophone = useCallback(() => {
    setAudioEnabled(!audioEnabled);
  }, [audioEnabled, setAudioEnabled]);

  const stopPreview = useCallback(() => {
    if (videoTrackRef.current) {
      videoTrackRef.current.stop();
      videoTrackRef.current = null;
      setVideoTrack(null);
    }
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
      setAudioTrack(null);
    }
  }, []);

  const startPreview = useCallback(async () => {
    // Explicit trigger (loads device names/labels)
    await loadDevices();
  }, [loadDevices]);

  // Clean up previews on unmount
  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  return {
    videoTrack,
    audioTrack,
    videoDevices,
    audioDevices,
    isCameraPermissionDenied,
    isMicPermissionDenied,
    startPreview,
    stopPreview,
    toggleCamera,
    toggleMicrophone,
    selectCamera: setVideoDeviceId,
    selectMicrophone: setAudioDeviceId,
  };
}
