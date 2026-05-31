'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { useChat } from '@/hooks/livekit/useChat';
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
    <div className="w-80 h-full bg-brand-surface border-l border-brand-border flex flex-col justify-between animate-fade-in relative z-20">
      
      {/* Header */}
      <div className="p-4 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-orange" />
          <h4 className="font-bold text-white text-sm uppercase tracking-wider">
            In-Call Chat
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-brand-border rounded-lg text-brand-text-secondary hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <MessageSquare className="w-8 h-8 text-brand-border mb-2" />
            <p className="text-xs text-brand-text-secondary">
              No messages yet in this room.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderIdentity === room.localParticipant.identity;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${
                  isMe ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <span className="text-[10px] text-brand-text-secondary mb-1 font-semibold">
                  {msg.senderName}
                </span>
                <div
                  className={`px-3.5 py-2 rounded-2xl text-xs break-words w-full ${
                    isMe
                      ? 'bg-brand-orange text-white rounded-tr-none'
                      : 'bg-brand-dark border border-brand-border text-brand-text-primary rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-brand-text-secondary/70 mt-1">
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
      <form onSubmit={handleSend} className="p-4 border-t border-brand-border flex gap-2">
        <input
          type="text"
          placeholder="Send a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-brand-dark border border-brand-border focus:border-brand-orange/50 px-3 py-2 rounded-xl text-xs text-white outline-none transition-colors"
        />
        <button
          type="submit"
          className="p-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white rounded-xl transition-colors flex items-center justify-center shadow-md shadow-brand-orange/10"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
