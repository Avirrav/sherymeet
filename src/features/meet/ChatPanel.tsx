'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { useChat } from '@/hooks/media-server/useChat';
import { Room } from 'livekit-client';

interface ChatPanelProps {
  room: Room;
  onClose: () => void;
}

export default function ChatPanel({ room, onClose }: ChatPanelProps) {
  const { sendMessage, messages } = useChat(room);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  // Auto-scroll on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <MessageSquare className="w-8 h-8 text-md-outline-variant mb-2" />
            <p className="text-xs text-md-on-surface-variant">
              No messages yet in this room.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderIdentity === room.localParticipant.identity;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] animate-message-in ${
                  isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <span className="text-[10px] text-md-on-surface-variant mb-1 font-semibold">
                  {msg.senderName}
                </span>
                <div
                  className={`px-3.5 py-2 rounded-2xl text-xs break-words w-full ${
                    isMe
                      ? 'bg-md-primary text-md-on-primary rounded-tr-none'
                      : 'bg-md-surface border border-md-outline-variant text-md-on-surface rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-md-on-surface-variant/70 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-md-outline-variant flex gap-2">
        <input
          type="text"
          placeholder="Send a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-md-surface border border-md-outline-variant focus:border-md-primary/50 px-3 py-2 rounded-xl text-xs text-md-on-surface outline-none transition-colors"
        />
        <button
          type="submit"
          className="p-2.5 bg-md-primary hover:bg-md-primary-hover text-md-on-primary rounded-xl transition-colors flex items-center justify-center"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
