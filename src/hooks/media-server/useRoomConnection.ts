import { useEffect, useState, useRef } from "react";
import { Room, RoomEvent, ConnectionState, VideoPresets } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { toAppError } from "@/app/backend/types/error-types";

interface UseRoomConnectionOptions {
  serverUrl: string;
  token: string;
}

export function useRoomConnection({
  serverUrl,
  token,
}: UseRoomConnectionOptions) {
  const [room, setRoom] = useState<Room | null>(null);
  const {
    setConnectionStatus,
    audioEnabled,
    videoEnabled,
    audioDeviceId,
    videoDeviceId,
    setVideoDeviceId,
    setAudioDeviceId,
  } = useMeetingStore();
  const connectingRef = useRef(false);

  useEffect(() => {
    // Return early if connection parameters are not yet loaded.
    // This prevents the LiveKit client from attempting to connect with empty strings,
    // which throws an "Invalid URL" TypeError.
    if (!serverUrl || !token) {
      console.log(
        "Connection parameters missing. Waiting for serverUrl and token...",
      );
      return;
    }
    if (room || connectingRef.current) {
      return;
    }
    connectingRef.current = true;
    setConnectionStatus(true, false, null);
    const r = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        videoSimulcastLayers: [VideoPresets.h720, VideoPresets.h360],
      },
    });

    const handleConnected = () => {
      console.log("RoomEvent.Connected event handler triggered");
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
        console.log("Calling r.connect(serverUrl, token)...", {
          serverUrl,
          token: token.substring(0, 15) + "...",
        });
        await r.connect(serverUrl, token);
        console.log("r.connect completed successfully! Room status:", r.state);
        setRoom(r);
        connectingRef.current = false;

        // Wait a short moment for any Pre-Join preview tracks to fully release their media handles
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Publish camera track if enabled
        if (videoEnabled) {
          let success = false;
          try {
            console.log("Publishing camera track in HD quality...");
            await r.localParticipant.setCameraEnabled(true, {
              deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
              resolution: VideoPresets.h720.resolution, // Publish in HD
            });
            console.log("Camera track published successfully.");
            success = true;
          } catch (unknownErr) {
            const err = toAppError(unknownErr);
            console.warn(
              "First camera publication attempt failed. Trying fallback devices...",
              err.message,
            );
          }

          if (!success) {
            try {
              const vDevices = await Room.getLocalDevices("videoinput");
              const otherCameras = vDevices.filter(
                (d) => d.deviceId !== videoDeviceId && d.deviceId !== "",
              );
              if (otherCameras.length > 0) {
                console.log(
                  "Publishing fallback camera device:",
                  otherCameras[0].deviceId,
                );
                await r.localParticipant.setCameraEnabled(true, {
                  deviceId: { exact: otherCameras[0].deviceId },
                  resolution: VideoPresets.h720.resolution,
                });
                setVideoDeviceId(otherCameras[0].deviceId);
                success = true;
                toast.info(
                  "Selected camera was busy. Switched to fallback camera.",
                  {
                    id: "room-cam-fallback",
                  },
                );
              }
            } catch (fallbackErr) {
              console.error("Fallback camera failed:", fallbackErr);
            }
          }

          if (!success) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 600));
              await r.localParticipant.setCameraEnabled(true, {
                deviceId: videoDeviceId || undefined,
                resolution: VideoPresets.h720.resolution,
              });
              console.log(
                "Camera track published successfully on second attempt.",
              );
            } catch (retryErr) {
              const err = toAppError(retryErr);
              console.error("Failed to publish camera on retry:", err.message);
              toast.error(
                "Failed to enable camera. Please make sure your camera is not in use by another app.",
              );
            }
          }
        }

        // Publish microphone track if enabled
        if (audioEnabled) {
          let success = false;
          try {
            console.log("Publishing microphone track...");
            await r.localParticipant.setMicrophoneEnabled(true, {
              deviceId: audioDeviceId || undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            });
            console.log("Microphone track published successfully.");
            success = true;
          } catch (unknownErr) {
            const err = toAppError(unknownErr);
            console.warn(
              "First microphone publication attempt failed. Trying fallback devices...",
              err.message,
            );
          }

          if (!success) {
            try {
              const aDevices = await Room.getLocalDevices("audioinput");
              const otherMics = aDevices.filter(
                (d) => d.deviceId !== audioDeviceId && d.deviceId !== "",
              );
              if (otherMics.length > 0) {
                console.log(
                  "Publishing fallback microphone device:",
                  otherMics[0].deviceId,
                );
                await r.localParticipant.setMicrophoneEnabled(true, {
                  deviceId: otherMics[0].deviceId,
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                });
                setAudioDeviceId(otherMics[0].deviceId);
                success = true;
                toast.info(
                  "Selected microphone was busy. Switched to fallback microphone.",
                  {
                    id: "room-mic-fallback",
                  },
                );
              }
            } catch (fallbackErr) {
              console.error("Fallback microphone failed:", fallbackErr);
            }
          }

          if (!success) {
            try {
              await new Promise((resolve) => setTimeout(resolve, 600));
              await r.localParticipant.setMicrophoneEnabled(true, {
                deviceId: audioDeviceId || undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              });
              console.log(
                "Microphone track published successfully on second attempt.",
              );
            } catch (retryErr) {
              const err = toAppError(retryErr);
              console.error(
                "Failed to publish microphone on retry:",
                err.message,
              );
              toast.error("Failed to enable microphone.");
            }
          }
        }
      } catch (unknownErr) {
        const err = toAppError(unknownErr);
        console.error("Connection failed inside catch block:", err);
        const errMsg = err.message || "Connection failed";
        let userFriendlyMsg = errMsg;
        if (
          errMsg.toLowerCase().includes("full") ||
          errMsg.toLowerCase().includes("limit") ||
          errMsg.toLowerCase().includes("max")
        ) {
          userFriendlyMsg =
            "Room is full. Participant limit (2) reached for this meeting.";
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

  // Sync mic/camera state toggles in the active room with fallback logic and HD settings
  useEffect(() => {
    if (!room || room.state !== ConnectionState.Connected) return;

    let active = true;

    const syncMedia = async () => {
      try {
        if (videoEnabled) {
          console.log(
            "Active Room: enabling camera with HD quality for device:",
            videoDeviceId,
          );
          await room.localParticipant.setCameraEnabled(true, {
            deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
            resolution: VideoPresets.h720.resolution, // Publish in HD
          });
          console.log("Active Room: camera enabled successfully.");
        } else {
          console.log("Active Room: disabling camera.");
          await room.localParticipant.setCameraEnabled(false);
        }
      } catch (unknownErr) {
        if (!active) return;
        const err = toAppError(unknownErr);
        console.warn(
          "Active Room: error toggling camera, trying fallback...",
          err.message,
        );

        if (videoEnabled) {
          try {
            const vDevices = await Room.getLocalDevices("videoinput");
            const otherCameras = vDevices.filter(
              (d) => d.deviceId !== videoDeviceId && d.deviceId !== "",
            );
            if (otherCameras.length > 0) {
              console.log(
                "Active Room: trying fallback camera device:",
                otherCameras[0].deviceId,
              );
              await room.localParticipant.setCameraEnabled(true, {
                deviceId: { exact: otherCameras[0].deviceId },
                resolution: VideoPresets.h720.resolution,
              });
              if (active) {
                setVideoDeviceId(otherCameras[0].deviceId);
                toast.info(
                  "Selected camera was busy/unavailable. Switched to another camera.",
                  {
                    id: "room-cam-fallback-sync",
                  },
                );
              }
              return;
            }
          } catch (fallbackErr) {
            console.error("Active Room: fallback camera failed:", fallbackErr);
          }
        }

        toast.error(
          "Failed to enable camera. Please make sure it is not in use by another app.",
          {
            id: "room-cam-error-sync",
          },
        );
      }
    };
    syncMedia();

    return () => {
      active = false;
    };
  }, [videoEnabled, videoDeviceId, room, setVideoDeviceId]);

  useEffect(() => {
    if (!room || room.state !== ConnectionState.Connected) return;

    let active = true;

    const syncMedia = async () => {
      try {
        if (audioEnabled) {
          console.log(
            "Active Room: enabling microphone for device:",
            audioDeviceId,
          );
          await room.localParticipant.setMicrophoneEnabled(true, {
            deviceId: audioDeviceId || undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
          console.log("Active Room: microphone enabled successfully.");
        } else {
          console.log("Active Room: disabling microphone.");
          await room.localParticipant.setMicrophoneEnabled(false);
        }
      } catch (unknownErr) {
        if (!active) return;
        const err = toAppError(unknownErr);
        console.warn(
          "Active Room: error toggling microphone, trying fallback...",
          err.message,
        );

        if (audioEnabled) {
          try {
            const aDevices = await Room.getLocalDevices("audioinput");
            const otherMics = aDevices.filter(
              (d) => d.deviceId !== audioDeviceId && d.deviceId !== "",
            );
            if (otherMics.length > 0) {
              console.log(
                "Active Room: trying fallback microphone device:",
                otherMics[0].deviceId,
              );
              await room.localParticipant.setMicrophoneEnabled(true, {
                deviceId: otherMics[0].deviceId,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              });
              if (active) {
                setAudioDeviceId(otherMics[0].deviceId);
                toast.info(
                  "Selected microphone was busy. Switched to another microphone.",
                  {
                    id: "room-mic-fallback-sync",
                  },
                );
              }
              return;
            }
          } catch (fallbackErr) {
            console.error(
              "Active Room: fallback microphone failed:",
              fallbackErr,
            );
          }
        }

        toast.error(
          "Failed to enable microphone. Please check your system settings.",
          {
            id: "room-mic-error-sync",
          },
        );
      }
    };
    syncMedia();

    return () => {
      active = false;
    };
  }, [audioEnabled, audioDeviceId, room, setAudioDeviceId]);

  return room;
}
