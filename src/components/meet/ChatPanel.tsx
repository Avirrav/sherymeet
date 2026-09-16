"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, X, MessageSquare } from "lucide-react";
import { useChat } from "@/hooks/media-server/useChat";
import { Room, ConnectionState } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import type { ChatRecipient } from "@/store/useMeetingStore";
import { isHostRole } from "./participant-permissions";
import ChatLockControl from "./ChatLockControl";

interface ChatPanelProps {
  room: Room;
  onClose: () => void;
}

export default function ChatPanel({ room, onClose }: ChatPanelProps) {
  const { sendMessage, messages } = useChat(room, undefined, false);
  const chatEnabled = useMeetingStore((state) => state.chatEnabled);
  const chatSlowModeSeconds = useMeetingStore((state) => state.chatSlowModeSeconds);
  const lastChatSentAt = useMeetingStore((state) => state.lastChatSentAt);
  const isHost = isHostRole(room.localParticipant);
  const canCompose = (chatEnabled || isHost) && room.state === ConnectionState.Connected;
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [recipient, setRecipient] = useState<ChatRecipient>("everyone");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const canSend = canCompose && cooldownRemaining === 0;

  useEffect(() => {
    const update = () =>
      setCooldownRemaining(
        isHost
          ? 0
          : Math.max(
              0,
              Math.ceil((lastChatSentAt + chatSlowModeSeconds * 1000 - Date.now()) / 1000),
            ),
      );
    const initialTimer = setTimeout(update, 0);
    const interval = setInterval(update, 500);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isHost, lastChatSentAt, chatSlowModeSeconds]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || sending || !inputText.trim()) return;
    const text = inputText.trim();
    setSending(true);
    try {
      if (await sendMessage(text, recipient)) setInputText("");
    } finally {
      setSending(false);
    }
  };

  // Auto-scroll on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="w-80 h-full bg-md-surface-container-low border border-md-outline-variant/40 rounded-md-lg flex flex-col justify-between relative z-20">
      {/* Header */}
      <div className="p-4 border-b border-md-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-md-primary" />
          <h4 className="font-bold text-md-on-surface text-sm uppercase tracking-wider">
            In-Call Chat
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-md-outline-variant rounded-lg text-md-on-surface-variant hover:text-md-on-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {isHost && <ChatLockControl room={room} />}
      {!chatEnabled && (
        <p role="status" className="px-4 pb-3 text-xs text-md-on-surface-variant">
          {isHost
            ? "Participant chat is off. You can still send messages."
            : "The host has turned off participant chat."}
        </p>
      )}
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <MessageSquare className="w-8 h-8 text-md-outline-variant mb-2" />
            <p className="text-xs text-md-on-surface-variant">No messages yet in this room.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderIdentity === room.localParticipant.identity;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] animate-message-in ${
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                <span className="text-[10px] text-md-on-surface-variant mb-1 font-semibold">
                  {msg.senderName}
                </span>
                {msg.recipient === "host" && (
                  <span className="mb-1 rounded-full border border-md-primary/30 bg-md-primary/10 px-2 py-0.5 text-[9px] font-semibold text-md-primary">
                    {isMe ? "Sent privately to host" : "Private to host"}
                  </span>
                )}
                <div
                  className={`px-3.5 py-2 rounded-2xl text-xs break-words w-full ${
                    isMe
                      ? "bg-md-primary text-md-on-primary rounded-tr-none"
                      : "bg-md-surface border border-md-outline-variant text-md-on-surface rounded-tl-none"
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-md-on-surface-variant/70 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-md-outline-variant space-y-2">
        <label className="flex items-center justify-between gap-3 text-[10px] font-semibold text-md-on-surface-variant">
          Send to
          <select
            value={recipient}
            disabled={!canCompose || sending}
            onChange={(event) => setRecipient(event.target.value as ChatRecipient)}
            className="rounded-lg border border-md-outline-variant bg-md-surface px-2 py-1.5 text-xs text-md-on-surface outline-none focus:border-md-primary/50 disabled:opacity-50"
          >
            <option value="everyone">Everyone</option>
            <option value="host">Host only</option>
          </select>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            disabled={!canCompose || sending}
            aria-label="Chat message"
            placeholder={
              cooldownRemaining > 0
                ? `Slow mode: wait ${cooldownRemaining}s`
                : recipient === "host"
                  ? "Message the host privately..."
                  : "Send a message..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 min-w-0 bg-md-surface border border-md-outline-variant focus:border-md-primary/50 px-3 py-2 rounded-xl text-xs text-md-on-surface outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!canSend || sending || !inputText.trim()}
            aria-label={
              cooldownRemaining > 0
                ? `Wait ${cooldownRemaining} seconds before sending`
                : recipient === "host"
                  ? "Send privately to host"
                  : "Send message"
            }
            className="p-2.5 bg-md-primary hover:bg-md-primary-hover text-md-on-primary rounded-xl transition-colors flex items-center justify-center disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
