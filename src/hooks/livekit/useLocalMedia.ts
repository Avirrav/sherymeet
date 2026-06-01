import { useState, useEffect, useCallback, useRef } from "react";
import {
  createLocalVideoTrack,
  createLocalAudioTrack,
  LocalVideoTrack,
  LocalAudioTrack,
  Room,
} from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { toAppError } from "@/app/backend/types/error";

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

  // Sync ref with state
  useEffect(() => {
    videoTrackRef.current = videoTrack;
  }, [videoTrack]);

  useEffect(() => {
    audioTrackRef.current = audioTrack;
  }, [audioTrack]);

  const loadDevices = useCallback(async () => {
    try {
      const vDevices = await Room.getLocalDevices("videoinput");
      const aDevices = await Room.getLocalDevices("audioinput");

      setVideoDevices(vDevices);
      setAudioDevices(aDevices);

      // Set default devices if not already set
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

  const startPreview = useCallback(async () => {
    // 1. Setup Camera Track if enabled
    if (videoEnabled) {
      try {
        if (videoTrackRef.current) {
          videoTrackRef.current.stop();
        }

        const constraints: any = {};
        if (videoDeviceId) {
          constraints.deviceId = { exact: videoDeviceId };
        }

        const track = await createLocalVideoTrack(constraints);
        setVideoTrack(track);
        setIsCameraPermissionDenied(false);
      } catch (unknownErr) {
        const err = toAppError(unknownErr);
        console.error("Error creating video track:", err.message);
        setIsCameraPermissionDenied(true);
        setVideoEnabled(false);
        setVideoTrack(null);
        toast.warning("Camera permission denied or camera unavailable");
      }
    } else {
      if (videoTrackRef.current) {
        videoTrackRef.current.stop();
        setVideoTrack(null);
      }
    }

    // 2. Setup Microphone Track if enabled
    if (audioEnabled) {
      try {
        if (audioTrackRef.current) {
          audioTrackRef.current.stop();
        }

        const constraints: any = {};
        if (audioDeviceId) {
          constraints.deviceId = { exact: audioDeviceId };
        }

        const track = await createLocalAudioTrack(constraints);
        setAudioTrack(track);
        setIsMicPermissionDenied(false);
      } catch (unknownErr) {
        const err = toAppError(unknownErr);
        console.error("Error creating audio track:", err.message);
        setIsMicPermissionDenied(true);
        setAudioEnabled(false);
        setAudioTrack(null);
        toast.warning("Microphone permission denied or microphone unavailable");
      }
    } else {
      if (audioTrackRef.current) {
        audioTrackRef.current.stop();
        setAudioTrack(null);
      }
    }

    // Enumerate devices again after getting permissions to get names/labels
    await loadDevices();
  }, [
    videoEnabled,
    audioEnabled,
    videoDeviceId,
    audioDeviceId,
    setVideoEnabled,
    setAudioEnabled,
    loadDevices,
  ]);

  const stopPreview = useCallback(() => {
    if (videoTrackRef.current) {
      videoTrackRef.current.stop();
      setVideoTrack(null);
    }
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      setAudioTrack(null);
    }
  }, []);

  // Update track if device changes while enabled
  useEffect(() => {
    if (videoEnabled) {
      startPreview();
    }
  }, [videoDeviceId]);

  useEffect(() => {
    if (audioEnabled) {
      startPreview();
    }
  }, [audioDeviceId]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  const toggleCamera = useCallback(async () => {
    const nextState = !videoEnabled;
    setVideoEnabled(nextState);
    if (!nextState && videoTrackRef.current) {
      videoTrackRef.current.stop();
      setVideoTrack(null);
    }
  }, [videoEnabled, setVideoEnabled]);

  const toggleMicrophone = useCallback(async () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    if (!nextState && audioTrackRef.current) {
      audioTrackRef.current.stop();
      setAudioTrack(null);
    }
  }, [audioEnabled, setAudioEnabled]);

  // Force restart when toggled on
  useEffect(() => {
    if (videoEnabled && !videoTrack) {
      startPreview();
    }
    if (audioEnabled && !audioTrack) {
      startPreview();
    }
  }, [videoEnabled, audioEnabled, videoTrack, audioTrack]);

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
