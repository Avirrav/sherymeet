import React from 'react';
import MeetingPageClient from './MeetingPageClient';
import { Metadata } from 'next';
import { Clock, Link, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { getMeetDetails } from '@/app/backend/services/meet-services/get-meet-details';

interface Params {
  token?: string;
  roomId: string;
}

interface SearchParams {
  token?: string;
  userName?: string;
}

export const metadata: Metadata = {
  title: 'Meeting | 1:1 Meet',
  description: 'Join conference room.',
};

export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const roomId = resolvedParams.roomId;

  // 1. Fetch meeting details directly from backend service (secure server-side call)
  let meet = null;
  try {
    meet = await getMeetDetails({ roomId });
  } catch (error) {
    console.error('Failed to fetch meeting details in server component:', error);
  }

  // 2. Check if the meeting status is active or not
  const isActive = meet && meet.status === 'active';

  // 3. If the meeting status is not active, show the "meeting is not started yet" screen
  if (!isActive) {
    return (
      <div className="relative min-h-screen bg-brand-dark flex flex-col justify-center items-center overflow-hidden font-sans p-6">
        {/* Decorative background glow circles */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] aspect-square rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] aspect-square rounded-full bg-brand-orange/5 blur-[120px] pointer-events-none" />
        
        {/* Grid Pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md glass-panel rounded-2xl border border-brand-border/40 p-8 flex flex-col items-center text-center shadow-2xl animate-fade-in">
          {/* Sheryians Logo */}
          <div className="mb-8 flex items-center gap-4 bg-brand-surface/40 border border-brand-border/40 px-5 py-3 rounded-xl backdrop-blur-md">
            <Image
              src="https://dfdx9u0psdezh.cloudfront.net/logos/full-logo.webp"
              alt="Sheryians Coding School"
              width={160}
              height={38}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>

          <div className="w-16 h-16 rounded-full bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center text-brand-orange mb-6 animate-pulse-slow">
            <Clock className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-brand-text-primary mb-3">
            Meeting is not started yet
          </h1>
          
          <p className="text-sm text-brand-text-secondary leading-relaxed mb-8 max-w-sm">
            The host has not started this meeting yet, or the meeting has ended. Please wait for the host to activate the room, then check the status to join.
          </p>

          <div className="w-full flex flex-col gap-3">
            {/* A relative or empty link triggers a page reload in Next.js Server Components, refetching the server state */}
            <a 
              href=""
              className="inline-flex w-full items-center justify-center gap-2 bg-brand-orange hover:bg-brand-orange-hover text-white px-5 py-3 rounded-xl font-medium transition-colors cursor-pointer shadow-lg shadow-brand-orange/20"
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" />
              Check Status
            </a>
            
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center text-xs text-brand-text-secondary hover:text-brand-text-primary transition-colors py-2"
            >
              Go back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MeetingPageClient
      roomId={resolvedParams.roomId}
      token={resolvedSearchParams.token || ''}
      userName={resolvedSearchParams.userName || ''}
    />
  );
}

