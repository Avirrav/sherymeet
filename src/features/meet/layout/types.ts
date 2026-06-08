import { Track } from 'livekit-client';

export type LayoutMode = 
  | 'grid' 
  | 'spotlight' 
  | 'sidebar' 
  | 'presenter' 
  | 'content-first' 
  | 'pip';

export interface LayoutParticipant {
  id: string; // Participant identity
  name: string;
  isLocal: boolean;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isHandRaised: boolean;
  connectionQuality: string;
  lastSpokeAt?: number;
}

export interface LayoutScreenShare {
  id: string; // Screen share track ID or screen_share_${identity}
  participantId: string;
  track: Track;
}

export interface LayoutItem {
  id: string; // ID of the tile (participant ID or screen share ID)
  type: 'video' | 'screen';
  x: number;     // Left offset in pixels
  y: number;     // Top offset in pixels
  width: number;  // Width in pixels
  height: number; // Height in pixels
  zIndex: number;
}

export interface LayoutEngineParams {
  participants: LayoutParticipant[];
  screenShares: LayoutScreenShare[];
  pinnedUsers: string[];
  activeSpeakerId: string | null;
  viewportWidth: number;
  viewportHeight: number;
  mode: LayoutMode;
}
