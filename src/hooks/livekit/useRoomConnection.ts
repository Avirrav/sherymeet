import { useEffect, useState, useRef } from 'react';
import { Room, RoomEvent, ConnectionState, VideoPresets } from 'livekit-client';
import { useMeetingStore } from '@/store/useMeetingStore';
import { toast } from 'sonner';

interface UseRoomConnectionOptions {
  serverUrl: string;
  token: string;
}

export function useRoomConnection({ serverUrl, token }: UseRoomConnectionOptions) {
  const [room, setRoom] = useState<Room | null>(null);
  const { setConnectionStatus, audioEnabled, videoEnabled, audioDeviceId, videoDeviceId } = useMeetingStore();
  const connectingRef = useRef(false);

  useEffect(() => {
    if (!serverUrl || !token || room || connectingRef.current) return;

    connectingRef.current = true;
    setConnectionStatus(true, false, null);

    const r = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        videoSimulcastLayers: [
          VideoPresets.h720,
          VideoPresets.h360
        ],
      },
    });

    const handleConnected = () => {
      setConnectionStatus(false, true, null);
      toast.success('Successfully connected to meeting');
    };

    const handleDisconnected = () => {
      setConnectionStatus(false, false, null);
      toast.info('Disconnected from meeting');
    };

    const handleReconnecting = () => {
      setConnectionStatus(true, true, null);
      toast.warning('Network unstable, reconnecting...');
    };

    const handleReconnected = () => {
      setConnectionStatus(false, true, null);
      toast.success('Reconnected to meeting');
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

        // Publish camera track if enabled
        if (videoEnabled) {
          try {
            await r.localParticipant.setCameraEnabled(true, {
              deviceId: videoDeviceId || undefined,
            });
          } catch (err) {
            console.error('Failed to publish camera:', err);
            toast.error('Failed to enable camera in meeting');
          }
        }

        // Publish microphone track if enabled
        if (audioEnabled) {
          try {
            await r.localParticipant.setMicrophoneEnabled(true, {
              deviceId: audioDeviceId || undefined,
            });
          } catch (err) {
            console.error('Failed to publish microphone:', err);
            toast.error('Failed to enable microphone in meeting');
          }
        }
      } catch (err: any) {
        console.error('Connection failed:', err);
        const errMsg = err?.message || 'Connection failed';
        let userFriendlyMsg = errMsg;
        if (
          errMsg.toLowerCase().includes('full') ||
          errMsg.toLowerCase().includes('limit') ||
          errMsg.toLowerCase().includes('max')
        ) {
          userFriendlyMsg = 'Room is full. Participant limit (2) reached for this meeting.';
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
  }, [serverUrl, token]);

  // Sync mic/camera state toggles in the active room
  useEffect(() => {
    if (!room || room.state !== ConnectionState.Connected) return;

    const syncMedia = async () => {
      try {
        if (videoEnabled) {
          await room.localParticipant.setCameraEnabled(true, {
            deviceId: videoDeviceId || undefined,
          });
        } else {
          await room.localParticipant.setCameraEnabled(false);
        }
      } catch (err) {
        console.error('Error toggling camera in room:', err);
      }
    };
    syncMedia();
  }, [videoEnabled, videoDeviceId, room]);

  useEffect(() => {
    if (!room || room.state !== ConnectionState.Connected) return;

    const syncMedia = async () => {
      try {
        if (audioEnabled) {
          await room.localParticipant.setMicrophoneEnabled(true, {
            deviceId: audioDeviceId || undefined,
          });
        } else {
          await room.localParticipant.setMicrophoneEnabled(false);
        }
      } catch (err) {
        console.error('Error toggling mic in room:', err);
      }
    };
    syncMedia();
  }, [audioEnabled, audioDeviceId, room]);

  return room;
}
