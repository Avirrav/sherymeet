import React from "react";
import MeetingPageClient from "./MeetingPageClient";
import { Metadata } from "next";

interface Params {
  roomId: string;
}

interface SearchParams {
  token?: string;
}

// Generates dynamic metadata for the meeting page based on the room ID.
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

// Renders the meeting page component, fetching the room ID and token from the URL parameters and search parameters.
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
