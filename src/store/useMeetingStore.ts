import { create } from "zustand";

// Shape returned by GET /api/server/[sessionId]/details (dates arrive as ISO strings)
export interface MeetDetails {
  roomId: string;
  roomCode: string;
  status: "scheduled" | "active" | "ended";
  type: "webinar" | "meet";
  isRecording: boolean;
  isTranscription: boolean;
  hasPasscode: boolean;
  startedAt: string | null;
  endedAt: string | null;
}

export type ChatRecipient = "everyone" | "host";

export interface ChatMessage {
  id: string;
  senderName: string;
  senderIdentity: string;
  text: string;
  recipient: ChatRecipient;
  timestamp: number;
}

interface MeetingState {
  // Local User Preferences
  username: string;
  email: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;

  // Meeting Connection Info
  roomId: string;
  token: string;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  meetDetails: MeetDetails | null;

  // Active UI Controls
  isScreenSharing: boolean;
  isHandRaised: boolean;
  activeSidebar: "chat" | "participants" | "settings" | null;
  unreadChatCount: number;
  captionsEnabled: boolean;
  chatEnabled: boolean;
  setChatEnabled: (enabled: boolean) => void;
  chatSlowModeSeconds: number;
  setChatSlowModeSeconds: (seconds: number) => void;
  lastChatSentAt: number;
  setLastChatSentAt: (timestamp: number) => void;

  // Layout Options
  layoutMode: "grid" | "spotlight" | "sidebar" | "presenter" | "content-first" | "pip";
  pinnedParticipantIds: string[];

  // Sync state from LiveKit events
  chatMessages: ChatMessage[];
  raisedHands: string[]; // List of participant identities who raised their hand
  transcriptions: Record<string, string>; // Maps participant identity -> current transcription text

  // Actions
  setUsername: (name: string) => void;
  setEmail: (email: string) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;
  setAudioDeviceId: (id: string) => void;
  setVideoDeviceId: (id: string) => void;
  setMeetingInfo: (roomId: string, token: string) => void;
  setConnectionStatus: (connecting: boolean, connected: boolean, error?: string | null) => void;
  setMeetDetails: (details: MeetDetails | null) => void;
  toggleScreenShare: (active?: boolean) => void;
  toggleHandRaise: (active?: boolean) => void;
  toggleSidebar: (panel: "chat" | "participants" | "settings" | null) => void;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  addChatMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearChat: () => void;
  addRaisedHand: (identity: string) => void;
  removeRaisedHand: (identity: string) => void;
  toggleCaptions: (active?: boolean) => void;
  setTranscription: (identity: string, text: string) => void;
  setLayoutMode: (
    mode: "grid" | "spotlight" | "sidebar" | "presenter" | "content-first" | "pip",
  ) => void;
  togglePinParticipant: (identity: string) => void;
  clearPins: () => void;
  resetMeetingStore: () => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  // Local User Preferences defaults
  username: "",
  email: "",
  audioEnabled: true,
  videoEnabled: true,
  audioDeviceId: "",
  videoDeviceId: "",

  // Connection Info defaults
  roomId: "",
  token: "",
  isConnecting: false,
  isConnected: false,
  error: null,
  meetDetails: null,

  // Active UI Controls defaults
  isScreenSharing: false,
  isHandRaised: false,
  activeSidebar: null,
  unreadChatCount: 0,
  chatEnabled: true,
  setChatEnabled: (enabled) => set({ chatEnabled: enabled }),
  chatSlowModeSeconds: 0,
  setChatSlowModeSeconds: (seconds) => set({ chatSlowModeSeconds: seconds }),
  lastChatSentAt: 0,
  setLastChatSentAt: (timestamp) => set({ lastChatSentAt: timestamp }),
  captionsEnabled: false,

  // Layout Options defaults
  layoutMode: "grid",
  pinnedParticipantIds: [],

  // Event sync states defaults
  chatMessages: [],
  raisedHands: [],
  transcriptions: {},

  // Actions
  setUsername: (name) => set({ username: name }),
  setEmail: (email) => set({ email }),
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
  setVideoEnabled: (enabled) => set({ videoEnabled: enabled }),
  setAudioDeviceId: (id) => set({ audioDeviceId: id }),
  setVideoDeviceId: (id) => set({ videoDeviceId: id }),
  setMeetingInfo: (roomId, token) =>
    set(() => {
      let savedMessages: ChatMessage[] = [];
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem(`chat_messages_${roomId}`);
          if (cached) {
            savedMessages = JSON.parse(cached);
          }
        } catch (e) {
          console.error("Error loading chat from localStorage", e);
        }
      }
      return { roomId, token, chatMessages: savedMessages };
    }),
  setConnectionStatus: (connecting, connected, error = null) =>
    set({ isConnecting: connecting, isConnected: connected, error }),
  setMeetDetails: (details) => set({ meetDetails: details }),
  toggleScreenShare: (active) =>
    set((state) => ({ isScreenSharing: active !== undefined ? active : !state.isScreenSharing })),
  toggleHandRaise: (active) =>
    set((state) => ({ isHandRaised: active !== undefined ? active : !state.isHandRaised })),
  toggleSidebar: (panel) =>
    set((state) => {
      const nextPanel = state.activeSidebar === panel ? null : panel;
      return {
        activeSidebar: nextPanel,
        unreadChatCount: nextPanel === "chat" ? 0 : state.unreadChatCount,
      };
    }),
  toggleCamera: () => set((state) => ({ videoEnabled: !state.videoEnabled })),
  toggleMicrophone: () => set((state) => ({ audioEnabled: !state.audioEnabled })),
  addChatMessage: (msg) =>
    set((state) => {
      const newMsg: ChatMessage = {
        ...msg,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
      };
      const newMessages = [...state.chatMessages, newMsg];
      if (state.roomId && typeof window !== "undefined") {
        try {
          localStorage.setItem(`chat_messages_${state.roomId}`, JSON.stringify(newMessages));
        } catch (e) {
          console.error("Error saving chat to localStorage", e);
        }
      }
      return {
        chatMessages: newMessages,
        unreadChatCount: state.activeSidebar === "chat" ? 0 : state.unreadChatCount + 1,
      };
    }),
  clearChat: () =>
    set((state) => {
      if (state.roomId && typeof window !== "undefined") {
        try {
          localStorage.removeItem(`chat_messages_${state.roomId}`);
        } catch (e) {
          console.error("Error clearing chat from localStorage", e);
        }
      }
      return { chatMessages: [], unreadChatCount: 0 };
    }),
  addRaisedHand: (identity) =>
    set((state) => ({
      raisedHands: state.raisedHands.includes(identity)
        ? state.raisedHands
        : [...state.raisedHands, identity],
    })),
  removeRaisedHand: (identity) =>
    set((state) => ({
      raisedHands: state.raisedHands.filter((id) => id !== identity),
    })),
  toggleCaptions: (active) =>
    set((state) => ({ captionsEnabled: active !== undefined ? active : !state.captionsEnabled })),
  setTranscription: (identity, text) =>
    set((state) => ({
      transcriptions: {
        ...state.transcriptions,
        [identity]: text,
      },
    })),
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  togglePinParticipant: (identity) =>
    set((state) => ({
      pinnedParticipantIds: state.pinnedParticipantIds.includes(identity)
        ? state.pinnedParticipantIds.filter((id) => id !== identity)
        : [...state.pinnedParticipantIds, identity],
    })),
  clearPins: () => set({ pinnedParticipantIds: [] }),
  resetMeetingStore: () =>
    set({
      roomId: "",
      token: "",
      isConnecting: false,
      isConnected: false,
      error: null,
      meetDetails: null,
      isScreenSharing: false,
      isHandRaised: false,
      activeSidebar: null,
      unreadChatCount: 0,
      chatMessages: [],
      raisedHands: [],
      chatEnabled: true,
      chatSlowModeSeconds: 0,
      lastChatSentAt: 0,
      captionsEnabled: false,
      transcriptions: {},
      layoutMode: "grid",
      pinnedParticipantIds: [],
    }),
}));
