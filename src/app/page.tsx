'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Video, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [customRoomId, setCustomRoomId] = useState('');

  const handleStartInstantMeet = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/meet/room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.success && data.roomName) {
        toast.success('Secure room created!');
        router.push(`/meet/${data.roomName}`);
      } else {
        throw new Error(data.error || 'Failed to create room');
      }
    } catch (err: any) {
      console.error('Error starting instant meet:', err);
      toast.error(err?.message || 'Room creation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinCustomRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRoomId.trim()) {
      toast.error('Please enter a room code');
      return;
    }
    // Clean up room code spaces/formats if any
    const formattedId = customRoomId.trim().toLowerCase();
    router.push(`/meet/${formattedId}`);
  };

  return (
    <div className="relative min-h-screen bg-brand-dark flex flex-col justify-between overflow-x-hidden font-sans">
      {/* Decorative background glow circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
      
      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main Hero */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-6 py-16 md:py-24 flex flex-col items-center text-center my-auto">
        {/* Sheryians Logo */}
        <div className="mb-10 flex items-center gap-4 bg-brand-surface/40 border border-brand-border/40 px-6 py-4 rounded-2xl backdrop-blur-md">
          <img
            src="https://dfdx9u0psdezh.cloudfront.net/logos/full-logo.webp"
            alt="Sheryians Coding School"
            className="h-10 md:h-12 object-contain"
          />
          <span className="text-brand-border">|</span>
          <div className="flex items-center gap-1 bg-brand-orange/10 border border-brand-orange/20 px-2.5 py-1 rounded-lg text-[10px] font-black text-brand-orange uppercase tracking-wider">
            <span>1:1 Meet</span>
          </div>
        </div>

        {/* Sub-badge */}
        <div className="mb-6 px-4 py-1 rounded-full bg-brand-orange/10 border border-brand-orange/20 text-xs font-semibold text-brand-orange inline-flex items-center gap-1.5 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-ping" />
          <span>LEARN. BUILD. GET PLACED.</span>
        </div>

        {/* Headline */}
        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight max-w-3xl">
          Start an{' '}
          <span className="bg-gradient-to-r from-brand-orange to-orange-400 bg-clip-text text-transparent">
            Instant Meeting
          </span>
        </h2>

        {/* Subtext */}
        <p className="text-lg md:text-xl text-brand-text-secondary mb-12 max-w-2xl font-light">
          High-quality 1:1 video meetings designed for developers. Fast, secure, and powered by LiveKit.
        </p>

        {/* Actions Container */}
        <div className="w-full max-w-md flex flex-col gap-4 p-6 rounded-2xl bg-brand-surface/60 border border-brand-border glass-panel shadow-2xl">
          {/* Primary CTA */}
          <button
            onClick={handleStartInstantMeet}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white py-3.5 px-6 rounded-xl font-bold transition-all duration-200 shadow-lg shadow-brand-orange/20 hover:shadow-brand-orange/35 disabled:opacity-50 group text-base"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Video className="w-5 h-5" />
                <span>Start Instant Meet</span>
                <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-200 group-hover:translate-x-1" />
              </>
            )}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-brand-border/60"></div>
            <span className="flex-shrink mx-4 text-xs uppercase tracking-wider text-brand-text-secondary/60 font-semibold">
              Or join via code
            </span>
            <div className="flex-grow border-t border-brand-border/60"></div>
          </div>

          {/* Join Form */}
          <form onSubmit={handleJoinCustomRoom} className="flex gap-2">
            <input
              type="text"
              placeholder="Enter room code (e.g. abc-defg-hij)"
              value={customRoomId}
              onChange={(e) => setCustomRoomId(e.target.value)}
              className="flex-1 bg-brand-dark/80 border border-brand-border focus:border-brand-orange/50 px-4 py-3 rounded-xl text-white text-sm outline-none transition-colors duration-200"
            />
            <button
              type="submit"
              className="bg-brand-surface hover:bg-brand-border border border-brand-border hover:border-brand-text-secondary/20 px-5 rounded-xl font-semibold transition-all duration-200 text-sm text-brand-text-primary"
            >
              Join
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
