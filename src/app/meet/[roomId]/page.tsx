import React from "react";
import MeetingPageClient from "./MeetingPageClient";
import { Metadata } from "next";

interface Params {
  roomId: string;
}

interface SearchParams {
  token?: string;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { roomId } = await params;

  return {
    title: "Video Meeting",
    description:
      "Join a secure, high-quality video meeting on SheryMeet. HD video, screen sharing, and real-time collaboration.",
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: `Join Meeting - SheryMeet`,
      description: "Join a secure video conference with HD quality and end-to-end encryption.",
      type: "website",
    },
    other: {
      "room-id": roomId,
    },
  };
}

export default async function MeetingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { roomId } = await params;
  const { token } = await searchParams;
  return <MeetingPageClient roomId={roomId} token={token || ""} />;
}
