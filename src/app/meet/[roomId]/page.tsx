import React from 'react';
import MeetingPageClient from './MeetingPageClient';
import { Metadata } from 'next';

interface Params {
  roomId: string;
}

export const metadata: Metadata = {
  title: 'Meeting | 1:1 Meet',
  description: 'Join conference room.',
};

export default async function MeetingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const resolvedParams = await params;
  return <MeetingPageClient roomId={resolvedParams.roomId} />;
}
