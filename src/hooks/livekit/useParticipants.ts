import { useEffect, useState, useCallback } from 'react';
import { Room, RoomEvent, Participant, RemoteParticipant } from 'livekit-client';
import { toast } from 'sonner';

export function useParticipants(room: Room | null) {
  const [localParticipant, setLocalParticipant] = useState(room?.localParticipant || null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<Participant | null>(null);
  
  // Forces a state refresh when track states or subscriptions change
  const [updateKey, setUpdateKey] = useState(0);
  const forceUpdate = useCallback(() => setUpdateKey((k) => k + 1), []);

  const updateParticipantsList = useCallback(() => {
    if (!room) {
      setLocalParticipant(null);
      setRemoteParticipants([]);
      return;
    }
    setLocalParticipant(room.localParticipant);
    setRemoteParticipants(Array.from(room.remoteParticipants.values()));
  }, [room]);

  useEffect(() => {
    if (!room) return;

    // Defer the initial participants list load to a microtask to avoid synchronous setState inside the effect body.
    Promise.resolve().then(() => {
      updateParticipantsList();
    });

    const handleParticipantConnected = (p: RemoteParticipant) => {
      updateParticipantsList();
      toast.info(`${p.name || p.identity} joined the room`);
    };

    const handleParticipantDisconnected = (p: RemoteParticipant) => {
      updateParticipantsList();
      toast.info(`${p.name || p.identity} left the room`);
    };

    const handleTrackSubscribed = () => {
      forceUpdate();
    };

    const handleTrackUnsubscribed = () => {
      forceUpdate();
    };

    const handleTrackMuted = () => {
      forceUpdate();
    };

    const handleTrackUnmuted = () => {
      forceUpdate();
    };

    const handleActiveSpeakersChanged = (speakers: Participant[]) => {
      if (speakers.length > 0) {
        setActiveSpeaker(speakers[0]);
      } else {
        setActiveSpeaker(null);
      }
    };

    const handleLocalTrackPublished = () => {
      updateParticipantsList();
      forceUpdate();
    };

    const handleLocalTrackUnpublished = () => {
      updateParticipantsList();
      forceUpdate();
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.TrackMuted, handleTrackMuted);
    room.on(RoomEvent.TrackUnmuted, handleTrackUnmuted);
    room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.TrackMuted, handleTrackMuted);
      room.off(RoomEvent.TrackUnmuted, handleTrackUnmuted);
      room.off(RoomEvent.LocalTrackPublished, handleLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleLocalTrackUnpublished);
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
    };
  }, [room, updateParticipantsList, forceUpdate]);

  return {
    localParticipant,
    remoteParticipants,
    activeSpeaker,
    updateKey, // expose updateKey so consumer can use it in dependency lists
  };
}
