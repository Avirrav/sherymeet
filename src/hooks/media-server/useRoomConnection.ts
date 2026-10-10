import { useEffect, useState, useRef } from "react";
import { Room, RoomEvent, ConnectionState, VideoPresets } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { toAppError } from "@/types/error-types";
import {
  canParticipantUseMicrophone,
  canParticipantUseCamera,
} from "@/components/meet/participant-permissions";

interface UseRoomConnectionOptions {
  serverUrl: string;
  token: string;
}

export function useRoomConnection({ serverUrl, token }: UseRoomConnectionOptions) {
  const [room, setRoom] = useState<Room | null>(null);
  const {
    setConnectionStatus,
    audioEnabled,
    videoEnabled,
    audioDeviceId,
    videoDeviceId,
    setVideoDeviceId,
    setAudioDeviceId,
    setAudioEnabled,
    setVideoEnabled,
  } = useMeetingStore();
  const connectingRef = useRef(false);

  useEffect(() => {
    if (!serverUrl || !token) {
      return;
    }
    if (room || connectingRef.current) {
      return;
    }
    connectingRef.current = true;
    setConnectionStatus(true, false, null);
    const r = new Room({
      adaptiveStream: {
        pixelDensity: 3,
        pauseVideoInBackground: true,
      },
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h1080.resolution,
        facingMode: "user",
      },
      publishDefaults: {
        videoSimulcastLayers: [VideoPresets.h1080, VideoPresets.h720, VideoPresets.h360],
        videoCodec: "vp9",
        backupCodec: { codec: "vp8" },
        videoEncoding: {
          maxBitrate: 4_000_000,
          maxFramerate: 30,
          priority: "high",
        },
        screenShareEncoding: {
          maxBitrate: 4_000_000,
          maxFramerate: 30,
          priority: "high",
        },
        simulcast: true,
        stopMicTrackOnMute: false,
        dtx: true,
      },
    });
    const handleConnected = () => {
      setConnectionStatus(false, true, null);
      toast.success("Successfully connected to meeting");
    };
    const handleDisconnected = () => {
      setConnectionStatus(false, false, null);
      toast.info("Disconnected from meeting");
    };
    const handleReconnecting = () => {
      setConnectionStatus(true, true, null);
      toast.warning("Network unstable, reconnecting...");
    };
    const handleReconnected = () => {
      setConnectionStatus(false, true, null);
      toast.success("Reconnected to meeting");
    };
    r.on(RoomEvent.Connected, handleConnected);
    r.on(RoomEvent.Disconnected, handleDisconnected);
    r.on(RoomEvent.Reconnecting, handleReconnecting);
    r.on(RoomEvent.Reconnected, handleReconnected);
    async function connect() {
      try {
        await r.connect(serverUrl, token);
        setRoom(r);
        connectingRef.current = false;
        // Check if the local participant has permission to use the microphone and camera
        const canUseMicrophone = canParticipantUseMicrophone(r.localParticipant);
        const canUseCamera = canParticipantUseCamera(r.localParticipant);
        if ((!canUseCamera && videoEnabled) || (!canUseMicrophone && audioEnabled)) {
          toast.info("Some media controls need host permission in this meeting.");
        }
        if (!canUseMicrophone) setAudioEnabled(false);
        if (!canUseCamera) setVideoEnabled(false);
        if (!canUseMicrophone && !canUseCamera) return;
        await new Promise((resolve) => setTimeout(resolve, 400));
        const isMediaSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices;
        if (!isMediaSupported && (videoEnabled || audioEnabled)) {
          toast.warning(
            "Camera/Microphone access is not supported on unsecure HTTP connections. Please use HTTPS or localhost.",
          );
        }
        // Attempt to enable the camera if allowed and supported
        if (videoEnabled && canUseCamera && isMediaSupported) {
          let success = false;
          // Try to enable the camera with the preferred device ID first
          try {
            await r.localParticipant.setCameraEnabled(true, {
              deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
              resolution: VideoPresets.h1080.resolution,
            });
            success = true;
          } catch {
            // First attempt failed, try fallback
          }
          // If the initial attempt to enable the camera failed, try to find a fallback camera
          if (!success) {
            try {
              const vDevices = await Room.getLocalDevices("videoinput");
              const otherCameras = vDevices.filter(
                (d) => d.deviceId !== videoDeviceId && d.deviceId !== "",
              );
              if (otherCameras.length > 0) {
                await r.localParticipant.setCameraEnabled(true, {
                  deviceId: { exact: otherCameras[0].deviceId },
                  resolution: VideoPresets.h1080.resolution,
                });
                setVideoDeviceId(otherCameras[0].deviceId);
                success = true;
                toast.info("Selected camera was busy. Switched to fallback camera.", {
                  id: "room-cam-fallback",
                });
              }
            } catch {
              // Fallback failed
            }
          }
          // If all attempts to enable the camera failed, notify the user
          if (!success) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 600));
              await r.localParticipant.setCameraEnabled(true, {
                deviceId: videoDeviceId || undefined,
                resolution: VideoPresets.h1080.resolution,
              });
            } catch {
              toast.error(
                "Failed to enable camera. Please make sure your camera is not in use by another app.",
              );
            }
          }
        }
        // Attempt to enable the microphone if allowed and supported
        if (audioEnabled && canUseMicrophone && isMediaSupported) {
          let success = false;
          // Try to enable the microphone with the preferred device ID first
          try {
            await r.localParticipant.setMicrophoneEnabled(true, {
              deviceId: audioDeviceId || undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            });
            success = true;
          } catch {
            // First attempt failed, try fallback
          }
          // If the initial attempt to enable the microphone failed, try to find a fallback microphone
          if (!success) {
            try {
              const aDevices = await Room.getLocalDevices("audioinput");
              const otherMics = aDevices.filter(
                (d) => d.deviceId !== audioDeviceId && d.deviceId !== "",
              );
              if (otherMics.length > 0) {
                await r.localParticipant.setMicrophoneEnabled(true, {
                  deviceId: otherMics[0].deviceId,
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                });
                setAudioDeviceId(otherMics[0].deviceId);
                success = true;
                toast.info("Selected microphone was busy. Switched to fallback microphone.", {
                  id: "room-mic-fallback",
                });
              }
            } catch {
              // Fallback failed
            }
          }
          // If all attempts to enable the microphone failed, notify the user
          if (!success) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 600));
              await r.localParticipant.setMicrophoneEnabled(true, {
                deviceId: audioDeviceId || undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              });
            } catch {
              toast.error("Failed to enable microphone.");
            }
          }
        }
      } catch (unknownErr) {
        const err = toAppError(unknownErr);
        const errMsg = err.message || "Connection failed";
        let userFriendlyMsg = errMsg;
        if (
          errMsg.toLowerCase().includes("full") ||
          errMsg.toLowerCase().includes("limit") ||
          errMsg.toLowerCase().includes("max")
        ) {
          userFriendlyMsg = "Room is full. Participant limit (2) reached for this meeting.";
        }
        setConnectionStatus(false, false, userFriendlyMsg);
        connectingRef.current = false;
        toast.error(userFriendlyMsg);
        r.disconnect();
      }
    }
    connect();
    return () => {
      r.off(RoomEvent.Connected, handleConnected);
      r.off(RoomEvent.Disconnected, handleDisconnected);
      r.off(RoomEvent.Reconnecting, handleReconnecting);
      r.off(RoomEvent.Reconnected, handleReconnected);
      r.disconnect();
      setRoom(null);
      connectingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, token]);
  // Effect to synchronize the local media state with the room's state
  useEffect(() => {
    if (!room || room.state !== ConnectionState.Connected) return;
    if (!canParticipantUseCamera(room.localParticipant)) return;
    let active = true;
    // Flag to track if the component is still mounted and active
    const syncMedia = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        return;
      }
      try {
        // Attempt to enable the camera if it is supposed to be enabled
        if (videoEnabled) {
          let deviceId = videoDeviceId;
          if (!deviceId) {
            const vDevices = await Room.getLocalDevices("videoinput");
            if (vDevices.length > 0 && vDevices[0].deviceId) {
              deviceId = vDevices[0].deviceId;
              setVideoDeviceId(deviceId);
            }
          }
          await room.localParticipant.setCameraEnabled(true, {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            resolution: VideoPresets.h1080.resolution,
          });
        } else {
          await room.localParticipant.setCameraEnabled(false);
        }
      } catch {
        if (!active) return;
        if (videoEnabled) {
          try {
            const vDevices = await Room.getLocalDevices("videoinput");
            const otherCameras = vDevices.filter(
              (d) => d.deviceId !== videoDeviceId && d.deviceId !== "",
            );
            if (otherCameras.length > 0) {
              await room.localParticipant.setCameraEnabled(true, {
                deviceId: { exact: otherCameras[0].deviceId },
                resolution: VideoPresets.h1080.resolution,
              });
              if (active) {
                setVideoDeviceId(otherCameras[0].deviceId);
                toast.info("Selected camera was busy/unavailable. Switched to another camera.", {
                  id: "room-cam-fallback-sync",
                });
              }
              return;
            }
          } catch {
            // Fallback failed
          }
        }
        toast.error("Failed to enable camera. Please make sure it is not in use by another app.", {
          id: "room-cam-error-sync",
        });
      }
    };
    syncMedia();
    return () => {
      active = false;
    };
  }, [videoEnabled, videoDeviceId, room, setVideoDeviceId]);
  // Effect to synchronize the local audio state with the room's state
  useEffect(() => {
    if (!room || room.state !== ConnectionState.Connected) return;
    if (!canParticipantUseMicrophone(room.localParticipant)) return;
    let active = true;
    // Function to synchronize the local media state with the room's state
    const syncMedia = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        return;
      }
      // If the browser does not support media devices, exit early
      try {
        if (audioEnabled) {
          let deviceId = audioDeviceId;
          if (!deviceId) {
            const aDevices = await Room.getLocalDevices("audioinput");
            if (aDevices.length > 0 && aDevices[0].deviceId) {
              deviceId = aDevices[0].deviceId;
              setAudioDeviceId(deviceId);
            }
          }
          await room.localParticipant.setMicrophoneEnabled(true, {
            deviceId: deviceId || undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
        } else {
          await room.localParticipant.setMicrophoneEnabled(false);
        }
      } catch {
        if (!active) return;
        // If enabling the microphone failed, attempt to find a fallback microphone
        if (audioEnabled) {
          try {
            const aDevices = await Room.getLocalDevices("audioinput");
            const otherMics = aDevices.filter(
              (d) => d.deviceId !== audioDeviceId && d.deviceId !== "",
            );
            if (otherMics.length > 0) {
              await room.localParticipant.setMicrophoneEnabled(true, {
                deviceId: otherMics[0].deviceId,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              });
              if (active) {
                setAudioDeviceId(otherMics[0].deviceId);
                toast.info("Selected microphone was busy. Switched to another microphone.", {
                  id: "room-mic-fallback-sync",
                });
              }
              return;
            }
          } catch {
            // Fallback failed
          }
        }
        toast.error("Failed to enable microphone. Please check your system settings.", {
          id: "room-mic-error-sync",
        });
      }
    };
    syncMedia();
    return () => {
      active = false;
    };
  }, [audioEnabled, audioDeviceId, room, setAudioDeviceId]);

  return room;
}
