/**
 * SheryMeet Embed SDK
 *
 * Embed SheryMeet video conferences in any website using an iframe
 * with postMessage-based communication.
 */

import type {
  SheryMeetOptions,
  JoinOptions,
  EmbedState,
  EventMap,
  EventName,
  EventCallback,
  LayoutMode,
} from "./types";

const SOURCE_SDK = "sherymeet-sdk";
const SOURCE_PAGE = "sherymeet";
const PROTOCOL_VERSION = 1;

export class SheryMeet {
  private container: HTMLElement;
  private iframe: HTMLIFrameElement | null = null;
  private baseUrl: string;
  private debug: boolean;
  private listeners: Map<EventName, Set<EventCallback<unknown>>> = new Map();
  private isReady = false;
  private readyPromise: Promise<void>;
  private readyResolve: (() => void) | null = null;
  private currentRoomId: string | null = null;
  private state: EmbedState | null = null;
  private boundMessageHandler: (event: MessageEvent) => void;

  /** SDK version */
  static VERSION = "1.0.0";

  constructor(options: SheryMeetOptions) {
    // Resolve container
    if (typeof options.container === "string") {
      const el = document.querySelector(options.container);
      if (!el) {
        throw new Error(`[SheryMeet] Container not found: ${options.container}`);
      }
      this.container = el as HTMLElement;
    } else {
      this.container = options.container;
    }

    this.baseUrl = options.baseUrl || this.detectBaseUrl();
    this.debug = options.debug || false;

    // Setup ready promise
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    // Bind message handler
    this.boundMessageHandler = this.handleMessage.bind(this);
    window.addEventListener("message", this.boundMessageHandler);

    this.log("SDK initialized", { baseUrl: this.baseUrl, version: SheryMeet.VERSION });
  }

  private detectBaseUrl(): string {
    // Try to detect from script src
    if (typeof document !== "undefined") {
      const scripts = document.querySelectorAll('script[src*="shery-meet"]');
      for (const script of scripts) {
        const src = script.getAttribute("src");
        if (src) {
          try {
            const url = new URL(src, window.location.href);
            return url.origin;
          } catch {
            // Continue
          }
        }
      }
    }
    return typeof window !== "undefined" ? window.location.origin : "https://sherymeet.pugly.in";
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log("[SheryMeet SDK]", ...args);
    }
  }

  private handleMessage(event: MessageEvent): void {
    // Only accept messages from our iframe
    if (!this.iframe || event.source !== this.iframe.contentWindow) {
      return;
    }

    const data = event.data as {
      source?: string;
      v?: number;
      type?: string;
      payload?: unknown;
    } | null;

    if (!data || data.source !== SOURCE_PAGE) {
      return;
    }

    this.log("Received event:", data.type, data.payload);

    const eventType = data.type as EventName;

    // Handle ready event - complete handshake
    if (eventType === "ready") {
      this.sendMessage({ type: "init" });
      this.isReady = true;
      this.readyResolve?.();
    }

    // Update internal state
    if (eventType === "state-changed") {
      this.state = data.payload as EmbedState;
    }

    // Emit to listeners
    this.emit(eventType, data.payload as EventMap[typeof eventType]);
  }

  private sendMessage(data: { type: string; command?: string; payload?: unknown }): void {
    if (!this.iframe?.contentWindow) {
      this.log("Cannot send message: iframe not ready");
      return;
    }

    const message = {
      source: SOURCE_SDK,
      v: PROTOCOL_VERSION,
      ...data,
    };

    this.log("Sending:", data);
    this.iframe.contentWindow.postMessage(message, this.baseUrl);
  }

  private sendCommand(command: string, payload?: unknown): void {
    this.sendMessage({ type: "command", command, payload });
  }

  private emit<K extends EventName>(event: K, data: EventMap[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          (cb as EventCallback<EventMap[K]>)(data);
        } catch (err) {
          console.error(`[SheryMeet] Error in ${event} handler:`, err);
        }
      });
    }
  }

  private createIframe(roomId: string, params: URLSearchParams): HTMLIFrameElement {
    // Remove existing iframe and reset state
    if (this.iframe) {
      this.iframe.remove();
      this.isReady = false;
      this.readyPromise = new Promise((resolve) => {
        this.readyResolve = resolve;
      });
    }

    const iframe = document.createElement("iframe");
    iframe.src = `${this.baseUrl}/meet/${roomId}?${params.toString()}`;
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    iframe.allow = "camera;microphone;display-capture;autoplay;clipboard-write;fullscreen";
    iframe.setAttribute("allowfullscreen", "true");

    this.container.appendChild(iframe);
    this.iframe = iframe;

    return iframe;
  }

  // ============================================
  // Public API - Lifecycle
  // ============================================

  /**
   * Join a meeting room
   * @param roomId - The room ID to join
   * @param options - Join options including token and username
   * @returns Promise that resolves when successfully joined
   */
  async join(roomId: string, options: JoinOptions): Promise<void> {
    this.log("Joining room:", roomId);
    this.currentRoomId = roomId;

    // Build URL params
    const params = new URLSearchParams();
    params.set("embed", "1");
    params.set("token", options.token);
    params.set("username", options.username);
    if (options.email) params.set("email", options.email);
    if (options.audioEnabled !== undefined) params.set("audio", options.audioEnabled ? "1" : "0");
    if (options.videoEnabled !== undefined) params.set("video", options.videoEnabled ? "1" : "0");

    // Create iframe
    this.createIframe(roomId, params);

    // Wait for ready handshake
    await this.readyPromise;

    // Wait for joined event or error
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off("joined", onJoined);
        this.off("error", onError);
        reject(new Error("Join timeout - meeting may not be active"));
      }, 30000);

      const onJoined = () => {
        clearTimeout(timeout);
        this.off("joined", onJoined);
        this.off("error", onError);
        resolve();
      };

      const onError = (err: { message: string }) => {
        clearTimeout(timeout);
        this.off("joined", onJoined);
        this.off("error", onError);
        reject(new Error(err.message));
      };

      this.on("joined", onJoined);
      this.on("error", onError);
    });
  }

  /**
   * Leave the current meeting
   */
  leave(): void {
    this.log("Leaving meeting");
    this.sendCommand("leave");
  }

  /**
   * End the meeting for everyone (host only)
   */
  endMeeting(): void {
    this.log("Ending meeting");
    this.sendCommand("end");
  }

  /**
   * Destroy the SDK instance and cleanup resources
   */
  destroy(): void {
    this.log("Destroying SDK");
    window.removeEventListener("message", this.boundMessageHandler);
    this.listeners.clear();
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
    this.isReady = false;
    this.currentRoomId = null;
    this.state = null;
  }

  // ============================================
  // Public API - Media Controls
  // ============================================

  /**
   * Toggle camera on/off
   * @param enabled - Optional: set to specific state
   */
  toggleCamera(enabled?: boolean): void {
    this.sendCommand("toggle-camera", enabled !== undefined ? { enabled } : undefined);
  }

  /**
   * Toggle microphone on/off
   * @param enabled - Optional: set to specific state
   */
  toggleMic(enabled?: boolean): void {
    this.sendCommand("toggle-mic", enabled !== undefined ? { enabled } : undefined);
  }

  /**
   * Toggle screen sharing
   * @param enabled - Optional: set to specific state
   */
  toggleScreenShare(enabled?: boolean): void {
    this.sendCommand("toggle-screen-share", enabled !== undefined ? { enabled } : undefined);
  }

  // ============================================
  // Public API - Meeting Controls
  // ============================================

  /**
   * Send a chat message
   * @param message - Message text
   * @param recipient - Send to "everyone" or "host" only
   */
  sendChat(message: string, recipient: "everyone" | "host" = "everyone"): void {
    this.sendCommand("send-chat", { message, recipient });
  }

  /**
   * Raise or lower hand
   * @param raised - Optional: set to specific state
   */
  raiseHand(raised?: boolean): void {
    this.sendCommand("raise-hand", raised !== undefined ? { raised } : undefined);
  }

  /**
   * Set the video layout mode
   * @param mode - Layout mode
   */
  setLayout(mode: LayoutMode): void {
    this.sendCommand("set-layout", { mode });
  }

  /**
   * Request current meeting state
   * (triggers state-changed event)
   */
  requestState(): void {
    this.sendCommand("get-state");
  }

  // ============================================
  // Public API - Getters
  // ============================================

  /** Get current meeting state (may be stale - use requestState for fresh data) */
  getState(): EmbedState | null {
    return this.state;
  }

  /** Get current room ID */
  getRoomId(): string | null {
    return this.currentRoomId;
  }

  /** Check if SDK is ready */
  getIsReady(): boolean {
    return this.isReady;
  }

  // ============================================
  // Public API - Events
  // ============================================

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param callback - Event handler
   */
  on<K extends EventName>(event: K, callback: EventCallback<EventMap[K]>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param callback - Event handler to remove
   */
  off<K extends EventName>(event: K, callback: EventCallback<EventMap[K]>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<unknown>);
    }
  }

  /**
   * Subscribe to an event (fires once then auto-unsubscribes)
   * @param event - Event name
   * @param callback - Event handler
   */
  once<K extends EventName>(event: K, callback: EventCallback<EventMap[K]>): void {
    const wrappedCallback: EventCallback<EventMap[K]> = (data) => {
      this.off(event, wrappedCallback);
      callback(data);
    };
    this.on(event, wrappedCallback);
  }
}

export default SheryMeet;
