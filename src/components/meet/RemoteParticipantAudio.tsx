"use client";

import { useEffect, useRef } from "react";
import { ParticipantEvent, RemoteParticipant, RemoteTrack, Track } from "livekit-client";

/** Plays an off-stage audience member without adding a video tile. */
export default function RemoteParticipantAudio({
  participant,
}: {
  participant: RemoteParticipant;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    let attachedTrack: RemoteTrack | undefined;
    const syncTrack = () => {
      const track = participant.getTrackPublication(Track.Source.Microphone)?.track;
      if (track === attachedTrack) return;
      attachedTrack?.detach(element);
      attachedTrack = track;
      attachedTrack?.attach(element);
    };
    syncTrack();
    participant.on(ParticipantEvent.TrackSubscribed, syncTrack);
    participant.on(ParticipantEvent.TrackUnsubscribed, syncTrack);
    participant.on(ParticipantEvent.TrackUnpublished, syncTrack);
    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, syncTrack);
      participant.off(ParticipantEvent.TrackUnsubscribed, syncTrack);
      participant.off(ParticipantEvent.TrackUnpublished, syncTrack);
      attachedTrack?.detach(element);
    };
  }, [participant]);

  return <audio ref={audioRef} autoPlay className="hidden" />;
}
