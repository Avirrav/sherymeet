/**
 * Sherymeet Embed SDK
 *
 * Embeds a Sherymeet meeting page in an iframe and exposes a typed
 * event/command bridge over postMessage. The counterpart lives in the
 * Sherymeet app at src/features/meet/embed-bridge.ts — the protocol shapes
 * must stay in sync.
 *
 * Typical flow:
 *  1. Your backend calls the Sherymeet client API (HMAC-signed) to create a
 *     meeting and obtain a `startUrl` (host) or `meetLink` (participant).
 *  2. Your frontend passes that link to `SheryMeetEmbed`.
 *  3. Listen for lifecycle events; call leave()/endMeeting() as needed.
 */

const SOURCE_PAGE = "sherymeet";
const SOURCE_SDK = "sherymeet-sdk";
const PROTOCOL_VERSION = 1;

/** Events emitted by the embedded meeting page. */
export type SheryMeetEventType =
  | "ready"
  | "status"
  | "joined"
  | "left"
  | "meeting-ended"
  | "error";

export interface SheryMeetStatusPayload {
  /** Gate state of the meet page: verifying | noAccess | start | waitingHost | ready | error */
  gateStatus?: string;
  roomId?: string;
  message?: string;
}

export interface SheryMeetErrorPayload {
  message?: string;
}

export type SheryMeetEventPayload = SheryMeetStatusPayload & SheryMeetErrorPayload;

export type SheryMeetEventHandler = (payload: SheryMeetEventPayload) => void;

export interface SheryMeetEmbedOptions {
  /** Element (or CSS selector) the meeting iframe is mounted into. */
  container: HTMLElement | string;
  /**
   * Full meeting link returned by the Sherymeet client API
   * (`startUrl` from create-start-url, or `meetLink` from join-as-user).
   * Mutually exclusive with baseUrl/roomId/token.
   */
  meetLink?: string;
  /** Base URL of the Sherymeet deployment, e.g. https://meet.example.com */
  baseUrl?: string;
  /** Room ID, e.g. abc-defg-hij (used with baseUrl + token). */
  roomId?: string;
  /** LiveKit room token issued by the Sherymeet client API. */
  token?: string;
  /** Display name shown in the meeting. */
  userName?: string;
  /** Optional email forwarded to the meeting page. */
  email?: string;
  /** Extra CSS class for the iframe element. */
  iframeClassName?: string;
}

interface BridgeMessage {
  source?: string;
  v?: number;
  type?: string;
  payload?: SheryMeetEventPayload;
}

const IFRAME_ALLOW = [
  "camera",
  "microphone",
  "display-capture",
  "autoplay",
  "clipboard-write",
  "speaker-selection",
  "fullscreen",
].join("; ");

function resolveContainer(container: HTMLElement | string): HTMLElement {
  if (typeof container === "string") {
    const el = document.querySelector<HTMLElement>(container);
    if (!el) {
      throw new Error(`SheryMeetEmbed: no element matches selector "${container}"`);
    }
    return el;
  }
  return container;
}

function buildMeetUrl(options: SheryMeetEmbedOptions): URL {
  if (options.meetLink) {
    return new URL(options.meetLink);
  }
  if (!options.baseUrl || !options.roomId || !options.token) {
    throw new Error(
      "SheryMeetEmbed: provide either `meetLink`, or `baseUrl` + `roomId` + `token`",
    );
  }
  const url = new URL(`/meet/${options.roomId}`, options.baseUrl);
  // The token always travels in the hash fragment so it never appears in
  // server logs, proxies, or Referer headers.
  const hash = new URLSearchParams();
  hash.set("token", options.token);
  if (options.userName) hash.set("userName", options.userName);
  if (options.email) hash.set("email", options.email);
  url.hash = hash.toString();
  return url;
}

/**
 * Embeds a Sherymeet meeting and bridges its lifecycle into your app.
 *
 * ```ts
 * const meeting = new SheryMeetEmbed({
 *   container: "#meeting",
 *   meetLink, // from your backend via the Sherymeet client API
 * });
 * meeting.on("joined", () => console.log("in the room"));
 * meeting.on("meeting-ended", () => meeting.destroy());
 * ```
 */
export class SheryMeetEmbed {
  private iframe: HTMLIFrameElement | null = null;
  private readonly meetOrigin: string;
  private readonly listeners = new Map<SheryMeetEventType, Set<SheryMeetEventHandler>>();
  private readonly onMessage: (event: MessageEvent) => void;
  private destroyed = false;

  constructor(options: SheryMeetEmbedOptions) {
    if (typeof window === "undefined") {
      throw new Error("SheryMeetEmbed can only be used in a browser environment");
    }
    const container = resolveContainer(options.container);
    const meetUrl = buildMeetUrl(options);
    this.meetOrigin = meetUrl.origin;

    this.onMessage = (event: MessageEvent) => {
      if (this.destroyed || !this.iframe) return;
      if (event.origin !== this.meetOrigin) return;
      if (event.source !== this.iframe.contentWindow) return;
      const data = event.data as BridgeMessage | null;
      if (!data || data.source !== SOURCE_PAGE || data.v !== PROTOCOL_VERSION) return;

      if (data.type === "ready") {
        // Handshake: pin our origin on the page so it targets us for events
        // and only accepts commands from us.
        this.postToPage({ type: "init" });
      }
      this.emit(data.type as SheryMeetEventType, data.payload ?? {});
    };

    // Attach the listener before setting src so the page's "ready"
    // announcement can never be missed.
    window.addEventListener("message", this.onMessage);

    const iframe = document.createElement("iframe");
    iframe.allow = IFRAME_ALLOW;
    iframe.setAttribute("allowfullscreen", "true");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.display = "block";
    if (options.iframeClassName) {
      iframe.className = options.iframeClassName;
    }
    iframe.src = meetUrl.toString();
    container.appendChild(iframe);
    this.iframe = iframe;
  }

  /** Subscribes to a meeting event. Returns an unsubscribe function. */
  on(type: SheryMeetEventType, handler: SheryMeetEventHandler): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler);
    return () => this.off(type, handler);
  }

  /** Removes a previously registered event handler. */
  off(type: SheryMeetEventType, handler: SheryMeetEventHandler): void {
    this.listeners.get(type)?.delete(handler);
  }

  /** Asks the embedded page to leave the meeting (participant stays on page). */
  leave(): void {
    this.postToPage({ type: "command", command: "leave" });
  }

  /** Asks the embedded page to end the meeting for everyone (host only). */
  endMeeting(): void {
    this.postToPage({ type: "command", command: "end" });
  }

  /** Removes the iframe and all listeners. The instance cannot be reused. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("message", this.onMessage);
    this.iframe?.remove();
    this.iframe = null;
    this.listeners.clear();
  }

  private emit(type: SheryMeetEventType, payload: SheryMeetEventPayload): void {
    this.listeners.get(type)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (err) {
        // A throwing consumer handler must not break the bridge.
        console.error("SheryMeetEmbed: error in event handler", err);
      }
    });
  }

  private postToPage(message: Record<string, unknown>): void {
    this.iframe?.contentWindow?.postMessage(
      { source: SOURCE_SDK, v: PROTOCOL_VERSION, ...message },
      this.meetOrigin,
    );
  }
}

export default SheryMeetEmbed;
