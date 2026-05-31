import { useState, useEffect } from 'react';
import { Room, RoomEvent, ConnectionQuality, Participant } from 'livekit-client';

export function useConnectionQuality(room: Room | null) {
  const [qualities, setQualities] = useState<Record<string, ConnectionQuality>>({});

  useEffect(() => {
    if (!room) {
      setQualities({});
      return;
    }

    const updateQuality = (participant: Participant) => {
      setQualities((prev) => ({
        ...prev,
        [participant.identity]: participant.connectionQuality,
      }));
    };

    // Initialize qualities
    const initialQualities: Record<string, ConnectionQuality> = {};
    if (room.localParticipant) {
      initialQualities[room.localParticipant.identity] = room.localParticipant.connectionQuality;
    }
    room.remoteParticipants.forEach((p) => {
      initialQualities[p.identity] = p.connectionQuality;
    });
    setQualities(initialQualities);

    const handleConnectionQualityChanged = (quality: ConnectionQuality, participant: Participant) => {
      updateQuality(participant);
    };

    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);

    return () => {
      room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
    };
  }, [room]);

  return qualities;
}
