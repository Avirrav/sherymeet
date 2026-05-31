import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  senderName: string;
  senderIdentity: string;
  text: string;
  timestamp: number;
}

interface MeetingState {
  // Local User Preferences
  username: string;
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

  // Active UI Controls
  isScreenSharing: boolean;
  isHandRaised: boolean;
  activeSidebar: 'chat' | 'participants' | null;
  unreadChatCount: number;

  // Sync state from LiveKit events
  chatMessages: ChatMessage[];
  raisedHands: string[]; // List of participant identities who raised their hand

  // Actions
  setUsername: (name: string) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;
  setAudioDeviceId: (id: string) => void;
  setVideoDeviceId: (id: string) => void;
  setMeetingInfo: (roomId: string, token: string) => void;
  setConnectionStatus: (connecting: boolean, connected: boolean, error?: string | null) => void;
  toggleScreenShare: (active?: boolean) => void;
  toggleHandRaise: (active?: boolean) => void;
  toggleSidebar: (panel: 'chat' | 'participants' | null) => void;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
  addRaisedHand: (identity: string) => void;
  removeRaisedHand: (identity: string) => void;
  resetMeetingStore: () => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  // Local User Preferences defaults
  username: '',
  audioEnabled: true,
  videoEnabled: true,
  audioDeviceId: '',
  videoDeviceId: '',

  // Connection Info defaults
  roomId: '',
  token: '',
  isConnecting: false,
  isConnected: false,
  error: null,

  // Active UI Controls defaults
  isScreenSharing: false,
  isHandRaised: false,
  activeSidebar: null,
  unreadChatCount: 0,

  // Event sync states defaults
  chatMessages: [],
  raisedHands: [],

  // Actions
  setUsername: (name) => set({ username: name }),
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),
  setVideoEnabled: (enabled) => set({ videoEnabled: enabled }),
  setAudioDeviceId: (id) => set({ audioDeviceId: id }),
  setVideoDeviceId: (id) => set({ videoDeviceId: id }),
  setMeetingInfo: (roomId, token) => set({ roomId, token }),
  setConnectionStatus: (connecting, connected, error = null) =>
    set({ isConnecting: connecting, isConnected: connected, error }),
  toggleScreenShare: (active) =>
    set((state) => ({ isScreenSharing: active !== undefined ? active : !state.isScreenSharing })),
  toggleHandRaise: (active) =>
    set((state) => ({ isHandRaised: active !== undefined ? active : !state.isHandRaised })),
  toggleSidebar: (panel) =>
    set((state) => {
      const nextPanel = state.activeSidebar === panel ? null : panel;
      return {
        activeSidebar: nextPanel,
        unreadChatCount: nextPanel === 'chat' ? 0 : state.unreadChatCount,
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
      return {
        chatMessages: [...state.chatMessages, newMsg],
        unreadChatCount:
          state.activeSidebar === 'chat'
            ? 0
            : state.unreadChatCount + 1,
      };
    }),
  clearChat: () => set({ chatMessages: [], unreadChatCount: 0 }),
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
  resetMeetingStore: () =>
    set({
      roomId: '',
      token: '',
      isConnecting: false,
      isConnected: false,
      error: null,
      isScreenSharing: false,
      isHandRaised: false,
      activeSidebar: null,
      unreadChatCount: 0,
      chatMessages: [],
      raisedHands: [],
    }),
}));
