import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Participant, RemoteParticipant } from 'livekit-client';
import { useMeetingStore } from '@/store/useMeetingStore';
import { calculateLayout } from './layoutEngine';
import { LayoutParticipant, LayoutScreenShare, LayoutItem } from './types';
import LayoutAnimator from './LayoutAnimator';
import ParticipantTile from '../ParticipantTile';
import ScreenShareTile from './ScreenShareTile';

interface LayoutManagerProps {
  localParticipant: Participant | null;
  remoteParticipants: RemoteParticipant[];
  activeSpeaker: Participant | null;
  updateKey?: number;
  /** Shown when there is nothing to stage (e.g. webinar with no presenter yet). */
  emptyMessage?: string;
}

export const LayoutManager: React.FC<LayoutManagerProps> = ({
  localParticipant,
  remoteParticipants,
  activeSpeaker,
  updateKey,
  emptyMessage,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Connect layout store variables
  const { layoutMode, pinnedParticipantIds, togglePinParticipant } = useMeetingStore();

  // ResizeObserver to track container sizes in real-time
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 1. Gather all active participants and map to LayoutParticipant format
  const mappedParticipants = useMemo<LayoutParticipant[]>(() => {
    void updateKey;
    const list: LayoutParticipant[] = [];

    // Local participant
    if (localParticipant) {
      list.push({
        id: localParticipant.identity,
        name: localParticipant.name || localParticipant.identity,
        isLocal: true,
        isVideoEnabled: localParticipant.isCameraEnabled,
        isAudioEnabled: localParticipant.isMicrophoneEnabled,
        isHandRaised: useMeetingStore.getState().raisedHands.includes(localParticipant.identity),
        connectionQuality: localParticipant.connectionQuality,
      });
    }

    // Remote participants
    remoteParticipants.forEach((p) => {
      list.push({
        id: p.identity,
        name: p.name || p.identity,
        isLocal: false,
        isVideoEnabled: p.isCameraEnabled,
        isAudioEnabled: p.isMicrophoneEnabled,
        isHandRaised: useMeetingStore.getState().raisedHands.includes(p.identity),
        connectionQuality: p.connectionQuality,
      });
    });

    return list;
  }, [localParticipant, remoteParticipants, updateKey]);

  // 2. Gather all active screen share publications
  const mappedScreenShares = useMemo<LayoutScreenShare[]>(() => {
    void updateKey;
    const list: LayoutScreenShare[] = [];

    // Local screen share
    if (localParticipant) {
      const localPub = Array.from(localParticipant.videoTrackPublications.values()).find(
        (pub) => pub.source === 'screen_share' && pub.track
      );
      if (localPub && localPub.track) {
        list.push({
          id: localPub.track.sid || `screen_share_${localParticipant.identity}`,
          participantId: localParticipant.identity,
          track: localPub.track,
        });
      }
    }

    // Remote screen shares
    remoteParticipants.forEach((p) => {
      const remotePub = Array.from(p.videoTrackPublications.values()).find(
        (pub) => pub.source === 'screen_share' && pub.track
      );
      if (remotePub && remotePub.track) {
        list.push({
          id: remotePub.track.sid || `screen_share_${p.identity}`,
          participantId: p.identity,
          track: remotePub.track,
        });
      }
    });

    return list;
  }, [localParticipant, remoteParticipants, updateKey]);

  // 3. Compute layout coordinates
  const layoutItems = useMemo<LayoutItem[]>(() => {
    void updateKey;
    if (dimensions.width === 0 || dimensions.height === 0) return [];

    return calculateLayout({
      participants: mappedParticipants,
      screenShares: mappedScreenShares,
      pinnedUsers: pinnedParticipantIds,
      activeSpeakerId: activeSpeaker?.identity || null,
      viewportWidth: dimensions.width,
      viewportHeight: dimensions.height,
      mode: layoutMode,
    });
  }, [
    mappedParticipants,
    mappedScreenShares,
    pinnedParticipantIds,
    activeSpeaker,
    dimensions,
    layoutMode,
    updateKey,
  ]);

  // 4. Implement virtualization: Filter visible items and limit active video streams
  const virtualizedItems = useMemo(() => {
    let activeVideoCount = 0;
    const maxActiveVideos = 25; // Performance limit for simultaneous video renderings

    return layoutItems.map((item) => {
      // Bounding box visibility check
      const isVisible =
        item.x + item.width > 0 &&
        item.x < dimensions.width &&
        item.y + item.height > 0 &&
        item.y < dimensions.height;

      let isVirtual = !isVisible;

      // Limit concurrent camera feeds to prevent browser overload
      if (item.type === 'video') {
        if (isVisible) {
          activeVideoCount++;
          if (activeVideoCount > maxActiveVideos) {
            isVirtual = true; // Downgrade to placeholder/avatar-only
          }
        }
      }

      return {
        ...item,
        isVirtual,
      };
    });
  }, [layoutItems, dimensions]);

  // Map participant identities back to LiveKit objects for rendering
  const getParticipant = (identity: string): Participant | undefined => {
    if (localParticipant?.identity === identity) return localParticipant;
    return remoteParticipants.find((p) => p.identity === identity);
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-brand-dark/40 rounded-3xl min-h-[450px]"
    >
      {virtualizedItems.map((item) => {
        if (item.type === 'screen') {
          // Render Screen Share Tile
          const share = mappedScreenShares.find((s) => s.id === item.id);
          const presenter = getParticipant(share?.participantId || '');
          if (!share || !share.track || !presenter) return null;

          return (
            <LayoutAnimator key={item.id} layout={item}>
              <ScreenShareTile
                track={share.track}
                presenterName={presenter.name || presenter.identity}
              />
            </LayoutAnimator>
          );
        } else {
          // Render Participant Camera Tile
          const participant = getParticipant(item.id);
          if (!participant) return null;

          const isLocal = participant.identity === localParticipant?.identity;

          return (
            <LayoutAnimator key={item.id} layout={item}>
              <ParticipantTile
                participant={participant}
                isLocal={isLocal}
                isSpeaker={activeSpeaker?.identity === participant.identity}
                isVirtual={item.isVirtual}
                pinned={pinnedParticipantIds.includes(participant.identity)}
                onPinToggle={() => togglePinParticipant(participant.identity)}
              />
            </LayoutAnimator>
          );
        }
      })}

      {mappedParticipants.length === 0 && mappedScreenShares.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-brand-text-secondary text-sm animate-fade-in">
          {emptyMessage ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-brand-orange/60 border-t-transparent animate-spin" />
              <span>{emptyMessage}</span>
            </>
          ) : (
            <span>No participants in call</span>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(LayoutManager);
