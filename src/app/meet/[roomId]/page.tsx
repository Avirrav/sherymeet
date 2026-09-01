import React from 'react';
import MeetingPageClient from './MeetingPageClient';
import { Metadata } from 'next';
import { Clock } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getMeetDetails } from '@/server/services/meet/get-meet-details';

interface Params {
  token?: string;
  roomId: string;
}

interface SearchParams {
  token?: string;
  recorder?: boolean;
  userName?: string;
  email?: string;
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
  return (
    <MeetingPageClient
      roomId={resolvedParams.roomId}
      token={resolvedSearchParams.token || ''}
      userName={resolvedSearchParams.userName || ''}
      email={resolvedSearchParams.email || ''}
      isRecorder={resolvedSearchParams.recorder}
    />
  );
}

