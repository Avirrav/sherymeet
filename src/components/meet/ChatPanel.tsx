"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Send,
  X,
  MessageSquare,
  Lock,
  ChevronDown,
  MoreVertical,
  MessageSquareOff,
  Trash2,
} from "lucide-react";
import { useChat } from "@/hooks/media-server/useChat";
import { Room, ConnectionState } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import type { ChatRecipient } from "@/store/useMeetingStore";
import { isHostRole, isCoHostOrAbove } from "./participant-permissions";
import ChatLockControl from "./ChatLockControl";
import { toast } from "sonner";

interface ChatPanelProps {
  room: Room;
  onClose: () => void;
  isFullScreen?: boolean;
}

export default function ChatPanel({ room, onClose, isFullScreen = false }: ChatPanelProps) {
  const { sendMessage, messages, broadcastDeleteMessage } = useChat(room, undefined, false);
  const chatEnabled = useMeetingStore((state) => state.chatEnabled);
  const chatSlowModeSeconds = useMeetingStore((state) => state.chatSlowModeSeconds);
  const lastChatSentAt = useMeetingStore((state) => state.lastChatSentAt);
  const token = useMeetingStore((state) => state.token);
  const isHost = isHostRole(room.localParticipant);
  const isAdmin = isCoHostOrAbove(room.localParticipant);
  const isChatBlocked = room.localParticipant.permissions?.canPublishData === false;
  const canCompose =
    (chatEnabled || isHost) && room.state === ConnectionState.Connected && !isChatBlocked;
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [recipient, setRecipient] = useState<ChatRecipient>("everyone");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const canSend = canCompose && cooldownRemaining === 0;

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const handleOpenMenu = useCallback(
    (msgId: string, buttonEl: HTMLButtonElement) => {
      if (openMenuId === msgId) {
        setOpenMenuId(null);
        setMenuPosition(null);
        return;
      }
      const rect = buttonEl.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 160),
      });
      setOpenMenuId(msgId);
    },
    [openMenuId],
  );

  const handleToggleChatBlock = async (
    identity: string,
    name: string,
    currentlyBlocked: boolean,
  ) => {
    setOpenMenuId(null);
    setMenuPosition(null);
    try {
      const response = await fetch(
        `/api/server/${encodeURIComponent(room.name)}/participants/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ identity, block: !currentlyBlocked }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Failed to update");
      toast.success(currentlyBlocked ? `${name} unblocked from chat` : `${name} blocked from chat`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update chat permission");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setOpenMenuId(null);
    setMenuPosition(null);
    await broadcastDeleteMessage(messageId);
    toast.success("Message deleted for everyone");
  };

  // Check if a participant is chat blocked
  const isParticipantChatBlocked = (identity: string): boolean => {
    const participant = Array.from(room.remoteParticipants.values()).find(
      (p) => p.identity === identity,
    );
    return participant?.permissions?.canPublishData === false;
  };

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      className={`${isFullScreen ? "w-full rounded-none" : "w-80 rounded-2xl"} h-full bg-md-surface-container-low border border-md-outline-variant/30 flex flex-col overflow-hidden relative z-20`}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-md-outline-variant/30 flex items-center justify-between bg-md-surface-container/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-md-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-md-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-md-on-surface text-sm">Chat</h4>
            <p className="text-[10px] text-md-on-surface-variant">
              {messages.length} {messages.length === 1 ? "message" : "messages"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-md-surface-variant/50 rounded-lg text-md-on-surface-variant hover:text-md-on-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Admin Controls (Host & Co-host) */}
      {isAdmin && <ChatLockControl room={room} />}

      {/* Chat Disabled Notice */}
      {!chatEnabled && !isHost && (
        <div className="flex-shrink-0 mx-3 mt-3 p-3 rounded-xl bg-md-error-container/10 border border-md-error/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-md-error/10 flex items-center justify-center flex-shrink-0">
              <Lock className="w-4 h-4 text-md-error" />
            </div>
            <p className="text-xs text-md-on-surface-variant leading-relaxed">
              Chat is currently disabled by the host.
            </p>
          </div>
        </div>
      )}

      {/* Chat Blocked Notice */}
      {isChatBlocked && (
        <div className="flex-shrink-0 mx-3 mt-3 p-3 rounded-xl bg-md-error-container/10 border border-md-error/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-md-error/10 flex items-center justify-center flex-shrink-0">
              <MessageSquareOff className="w-4 h-4 text-md-error" />
            </div>
            <p className="text-xs text-md-on-surface-variant leading-relaxed">
              You have been blocked from chatting by the host.
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 scrollbar-hidden">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-md-surface-container flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-md-outline" />
            </div>
            <p className="text-sm font-medium text-md-on-surface mb-1">No messages yet</p>
            <p className="text-xs text-md-on-surface-variant">
              Start the conversation with everyone in this room.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderIdentity === room.localParticipant.identity;
            const showMenu = isAdmin && !isMe;
            return (
              <div
                key={msg.id}
                className={`group flex flex-col max-w-[85%] animate-message-in ${
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-md-on-surface-variant font-medium">
                    {isMe ? "You" : msg.senderName}
                  </span>
                  <span
                    className="text-[9px] text-md-on-surface-variant/50"
                    suppressHydrationWarning
                  >
                    {new Date(msg.timestamp).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {msg.recipient === "host" && (
                  <span className="mb-1.5 rounded-full border border-md-primary/20 bg-md-primary/10 px-2 py-0.5 text-[9px] font-medium text-md-primary">
                    {isMe ? "Private to host" : "Private message"}
                  </span>
                )}
                <div className="relative flex items-start gap-1">
                  <div
                    className={`px-3 py-2 text-[13px] leading-relaxed break-words ${
                      isMe
                        ? "bg-md-primary text-md-on-primary rounded-2xl rounded-br-md"
                        : "bg-md-surface-container border border-md-outline-variant/30 text-md-on-surface rounded-2xl rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {showMenu && (
                    <button
                      onClick={(e) => handleOpenMenu(msg.id, e.currentTarget)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-md-surface-variant/50 text-md-on-surface-variant transition-opacity"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSend}
        className="flex-shrink-0 p-3 border-t border-md-outline-variant/30 bg-md-surface-container/30 space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-md-on-surface-variant">To:</span>
          <div className="relative">
            <select
              value={recipient}
              disabled={!canCompose || sending}
              onChange={(event) => setRecipient(event.target.value as ChatRecipient)}
              className="appearance-none rounded-lg border border-md-outline-variant/50 bg-md-surface pl-3 pr-7 py-1.5 text-xs text-md-on-surface outline-none focus:border-md-primary disabled:opacity-50 cursor-pointer"
            >
              <option value="everyone">Everyone</option>
              <option value="host">Host only</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-md-on-surface-variant pointer-events-none" />
          </div>
        </div>

        <div className="flex items-end gap-2">
          <input
            type="text"
            disabled={!canCompose || sending}
            aria-label="Chat message"
            placeholder={
              cooldownRemaining > 0
                ? `Wait ${cooldownRemaining}s...`
                : recipient === "host"
                  ? "Private message to host..."
                  : "Type a message..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 min-w-0 bg-md-surface border border-md-outline-variant/50 focus:border-md-primary/50 px-3.5 py-2.5 rounded-xl text-sm text-md-on-surface placeholder:text-md-on-surface-variant/60 outline-none transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canSend || sending || !inputText.trim()}
            aria-label={
              cooldownRemaining > 0
                ? `Wait ${cooldownRemaining} seconds`
                : recipient === "host"
                  ? "Send to host"
                  : "Send message"
            }
            className="flex-shrink-0 w-10 h-10 bg-md-primary hover:bg-md-primary-hover text-md-on-primary rounded-xl transition-[colors,transform] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Dropdown menu rendered via portal */}
      {openMenuId &&
        menuPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            className="fixed z-[200] min-w-[140px] bg-md-surface-container-high border border-md-outline-variant/50 rounded-lg shadow-xl py-1 animate-fade-in"
          >
            {(() => {
              const msg = messages.find((m) => m.id === openMenuId);
              if (!msg) return null;
              const userIsBlocked = isParticipantChatBlocked(msg.senderIdentity);
              return (
                <>
                  <button
                    onClick={() =>
                      handleToggleChatBlock(msg.senderIdentity, msg.senderName, userIsBlocked)
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-md-on-surface hover:bg-md-surface-variant/50 transition-colors"
                  >
                    {userIsBlocked ? (
                      <>
                        <MessageSquare className="w-3.5 h-3.5 text-md-tertiary" />
                        Unblock from chat
                      </>
                    ) : (
                      <>
                        <MessageSquareOff className="w-3.5 h-3.5 text-md-error" />
                        Block from chat
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-md-on-surface hover:bg-md-surface-variant/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-md-error" />
                    Delete message
                  </button>
                </>
              );
            })()}
          </div>,
          document.body,
        )}
    </div>
  );
}
