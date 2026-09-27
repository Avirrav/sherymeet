/**
 * postMessage bridge between the meet page and the SheryMeet embed SDK
 * when the page runs inside an iframe.
 *
 * Protocol (versioned, both directions carry a `source` discriminator):
 *   page -> SDK : { source: "sherymeet",     v: 1, type, payload }
 *   SDK  -> page: { source: "sherymeet-sdk", v: 1, type, payload }
 *
 * Handshake: the page announces "ready" (targetOrigin "*" — the payload is
 * empty, nothing sensitive leaves the frame). The SDK replies with "init";
 * from that point the parent's origin is pinned: all further events target
 * it, and commands from any other origin are ignored.
 */

const SOURCE_PAGE = "sherymeet";
const SOURCE_SDK = "sherymeet-sdk";
const PROTOCOL_VERSION = 1;

// ============================================
// Event Types (Page → SDK)
// ============================================

export type EmbedEventType =
  | "ready"
  | "status"
  | "joined"
  | "left"
  | "meeting-ended"
  | "error"
  | "participant-joined"
  | "participant-left"
  | "camera-changed"
  | "mic-changed"
  | "screen-share-changed"
  | "chat-received"
  | "active-speaker-changed"
  | "hand-raised"
  | "state-changed";

// ============================================
// Command Types (SDK → Page)
// ============================================

export type EmbedCommand =
  | "leave"
  | "end"
  | "toggle-camera"
  | "toggle-mic"
  | "toggle-screen-share"
  | "send-chat"
  | "raise-hand"
  | "set-layout"
  | "get-state";

export interface EmbedCommandPayload {
  "toggle-camera"?: { enabled?: boolean };
  "toggle-mic"?: { enabled?: boolean };
  "toggle-screen-share"?: { enabled?: boolean };
  "send-chat"?: { message: string; recipient?: "everyone" | "host" };
  "raise-hand"?: { raised?: boolean };
  "set-layout"?: { mode: "grid" | "spotlight" | "sidebar" | "presenter" | "content-first" | "pip" };
}

// ============================================
// Participant Type for Events
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
  layoutMode: string;
}

// ============================================
// Bridge State
// ============================================

let parentOrigin: string | null = null;
let commandHandlers: EmbedBridgeHandlers | null = null;

export function isEmbedded(): boolean {
  return typeof window !== "undefined" && window.self !== window.top;
}

export function getParentOrigin(): string | null {
  return parentOrigin;
}

// ============================================
// Emit Events to SDK
// ============================================

export function emitEmbedEvent(type: EmbedEventType, payload?: unknown): void {
  if (!isEmbedded()) return;
  window.parent.postMessage(
    { source: SOURCE_PAGE, v: PROTOCOL_VERSION, type, payload },
    parentOrigin ?? "*",
  );
}

export function emitParticipantJoined(participant: EmbedParticipant): void {
  emitEmbedEvent("participant-joined", participant);
}

export function emitParticipantLeft(participantId: string, name: string): void {
  emitEmbedEvent("participant-left", { participantId, name });
}

export function emitCameraChanged(enabled: boolean): void {
  emitEmbedEvent("camera-changed", { enabled });
}

export function emitMicChanged(enabled: boolean): void {
  emitEmbedEvent("mic-changed", { enabled });
}

export function emitScreenShareChanged(enabled: boolean): void {
  emitEmbedEvent("screen-share-changed", { enabled });
}

export function emitChatReceived(message: {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}): void {
  emitEmbedEvent("chat-received", message);
}

export function emitActiveSpeakerChanged(participantId: string | null): void {
  emitEmbedEvent("active-speaker-changed", { participantId });
}

export function emitHandRaised(participantId: string, raised: boolean): void {
  emitEmbedEvent("hand-raised", { participantId, raised });
}

export function emitStateChanged(state: EmbedState): void {
  emitEmbedEvent("state-changed", state);
}

// ============================================
// Bridge Handlers Interface
// ============================================

export interface EmbedBridgeHandlers {
  onCommand?: (command: EmbedCommand, payload?: unknown) => void;
  getStatusSnapshot?: () => unknown;

  // Specific command handlers
  onToggleCamera?: (enabled?: boolean) => void;
  onToggleMic?: (enabled?: boolean) => void;
  onToggleScreenShare?: (enabled?: boolean) => void;
  onSendChat?: (message: string, recipient?: "everyone" | "host") => void;
  onRaiseHand?: (raised?: boolean) => void;
  onSetLayout?: (mode: string) => void;
  onGetState?: () => void;
  onLeave?: () => void;
  onEnd?: () => void;
}

// ============================================
// Initialize Bridge
// ============================================

export function initEmbedBridge(handlers: EmbedBridgeHandlers): () => void {
  if (!isEmbedded()) return () => {};

  commandHandlers = handlers;

  const listener = (event: MessageEvent) => {
    const data = event.data as {
      source?: string;
      v?: number;
      type?: string;
      command?: string;
      payload?: unknown;
    } | null;

    if (!data || data.source !== SOURCE_SDK) return;

    // Handle init handshake
    if (data.type === "init") {
      parentOrigin = event.origin;
      emitEmbedEvent("status", handlers.getStatusSnapshot?.());
      return;
    }

    // Commands are only honored after the handshake pinned the SDK's origin
    if (!parentOrigin || event.origin !== parentOrigin) return;

    if (data.type === "command" && data.command) {
      const command = data.command as EmbedCommand;
      const payload = data.payload;

      // Call generic handler
      handlers.onCommand?.(command, payload);

      // Call specific handlers
      switch (command) {
        case "leave":
          handlers.onLeave?.();
          break;
        case "end":
          handlers.onEnd?.();
          break;
        case "toggle-camera": {
          const p = payload as EmbedCommandPayload["toggle-camera"];
          handlers.onToggleCamera?.(p?.enabled);
          break;
        }
        case "toggle-mic": {
          const p = payload as EmbedCommandPayload["toggle-mic"];
          handlers.onToggleMic?.(p?.enabled);
          break;
        }
        case "toggle-screen-share": {
          const p = payload as EmbedCommandPayload["toggle-screen-share"];
          handlers.onToggleScreenShare?.(p?.enabled);
          break;
        }
        case "send-chat": {
          const p = payload as EmbedCommandPayload["send-chat"];
          if (p?.message) {
            handlers.onSendChat?.(p.message, p.recipient);
          }
          break;
        }
        case "raise-hand": {
          const p = payload as EmbedCommandPayload["raise-hand"];
          handlers.onRaiseHand?.(p?.raised);
          break;
        }
        case "set-layout": {
          const p = payload as EmbedCommandPayload["set-layout"];
          if (p?.mode) {
            handlers.onSetLayout?.(p.mode);
          }
          break;
        }
        case "get-state":
          handlers.onGetState?.();
          break;
      }
    }
  };

  window.addEventListener("message", listener);
  emitEmbedEvent("ready");

  return () => {
    window.removeEventListener("message", listener);
    commandHandlers = null;
    parentOrigin = null;
  };
}

// ============================================
// Update Handlers (for dynamic handler updates)
// ============================================

export function updateEmbedHandlers(handlers: Partial<EmbedBridgeHandlers>): void {
  if (commandHandlers) {
    Object.assign(commandHandlers, handlers);
  }
}
