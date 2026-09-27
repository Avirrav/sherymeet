/**
 * SheryMeet Embed SDK Types
 */

// ============================================
// Configuration
// ============================================

export interface SheryMeetOptions {
  /** Container element or CSS selector */
  container: string | HTMLElement;
  /** Base URL of the SheryMeet server (defaults to current origin) */
  baseUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface JoinOptions {
  /** JWT token for authentication (from your backend) */
  token: string;
  /** Display name for the participant */
  username: string;
  /** Email address (optional) */
  email?: string;
  /** Start with audio enabled (default: true) */
  audioEnabled?: boolean;
  /** Start with video enabled (default: true) */
  videoEnabled?: boolean;
}

// ============================================
// State Types
// ============================================

export interface EmbedParticipant {
  id: string;
  name: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
}

export interface EmbedState {
  isConnected: boolean;
  roomId: string | null;
  localParticipant: EmbedParticipant | null;
  participants: EmbedParticipant[];
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  layoutMode: LayoutMode;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}

export type LayoutMode = "grid" | "spotlight" | "sidebar" | "presenter" | "content-first" | "pip";

// ============================================
// Event Types
// ============================================

export interface EventMap {
  /** SDK is ready to receive commands */
  ready: undefined;
  /** Gate status update (verifying, waiting, ready, etc.) */
  status: { gateStatus: string; roomId: string; message?: string };
  /** Successfully joined the meeting */
  joined: { roomId: string };
  /** Left the meeting */
  left: { roomId: string };
  /** Meeting was ended by host */
  "meeting-ended": { roomId: string };
  /** Error occurred */
  error: { message: string };
  /** A participant joined */
  "participant-joined": EmbedParticipant;
  /** A participant left */
  "participant-left": { participantId: string; name: string };
  /** Camera state changed */
  "camera-changed": { enabled: boolean };
  /** Microphone state changed */
  "mic-changed": { enabled: boolean };
  /** Screen share state changed */
  "screen-share-changed": { enabled: boolean };
  /** Chat message received */
  "chat-received": ChatMessage;
  /** Active speaker changed */
  "active-speaker-changed": { participantId: string | null };
  /** Hand raised/lowered */
  "hand-raised": { participantId: string; raised: boolean };
  /** Full state update */
  "state-changed": EmbedState;
}

export type EventName = keyof EventMap;
export type EventCallback<T> = (data: T) => void;
