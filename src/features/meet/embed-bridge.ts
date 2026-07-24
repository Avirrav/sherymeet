/**
 * postMessage bridge between the meet page and the Sherymeet embed SDK
 * (packages/sherymeet-sdk) when the page runs inside an iframe.
 *
 * Protocol (versioned, both directions carry a `source` discriminator):
 *   page -> SDK : { source: "sherymeet",     v: 1, type, payload }
 *   SDK  -> page: { source: "sherymeet-sdk", v: 1, type: "init" }
 *                 { source: "sherymeet-sdk", v: 1, type: "command", command }
 *
 * Handshake: the page announces "ready" (targetOrigin "*" — the payload is
 * empty, nothing sensitive leaves the frame). The SDK replies with "init";
 * from that point the parent's origin is pinned: all further events target
 * it, and commands from any other origin are ignored.
 */

const SOURCE_PAGE = "sherymeet";
const SOURCE_SDK = "sherymeet-sdk";
const PROTOCOL_VERSION = 1;

export type EmbedEventType =
  | "ready"
  | "status"
  | "joined"
  | "left"
  | "meeting-ended"
  | "error";

export type EmbedCommand = "leave" | "end";

let parentOrigin: string | null = null;

export function isEmbedded(): boolean {
  return typeof window !== "undefined" && window.self !== window.top;
}

/**
 * Emits an event to the embedding SDK. No-op when not running in an iframe.
 */
export function emitEmbedEvent(type: EmbedEventType, payload?: unknown): void {
  if (!isEmbedded()) return;
  window.parent.postMessage(
    { source: SOURCE_PAGE, v: PROTOCOL_VERSION, type, payload },
    parentOrigin ?? "*",
  );
}

interface EmbedBridgeHandlers {
  /** Invoked for commands from the SDK (only after the init handshake). */
  onCommand?: (command: EmbedCommand) => void;
  /** Current page state, re-sent to the SDK right after the handshake. */
  getStatusSnapshot?: () => unknown;
}

/**
 * Starts listening for SDK messages and announces readiness.
 * Returns a cleanup function. No-op outside an iframe.
 */
export function initEmbedBridge(handlers: EmbedBridgeHandlers): () => void {
  if (!isEmbedded()) return () => {};

  const listener = (event: MessageEvent) => {
    const data = event.data as
      | { source?: string; type?: string; command?: string }
      | null;
    if (!data || data.source !== SOURCE_SDK) return;

    if (data.type === "init") {
      parentOrigin = event.origin;
      emitEmbedEvent("status", handlers.getStatusSnapshot?.());
      return;
    }

    // Commands are only honored after the handshake pinned the SDK's origin.
    if (!parentOrigin || event.origin !== parentOrigin) return;
    if (data.type === "command" && (data.command === "leave" || data.command === "end")) {
      handlers.onCommand?.(data.command);
    }
  };

  window.addEventListener("message", listener);
  emitEmbedEvent("ready");

  return () => {
    window.removeEventListener("message", listener);
  };
}