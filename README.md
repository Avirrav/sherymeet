This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.



src/
├── app/
│   ├── api/
│   │   └── meet/
│   │       ├── room/           # Room creation API handler
│   │       └── token/          # Participant token generation API handler
│   ├── meet/
│   │   └── [roomId]/
│   │       ├── page.tsx        # Dynamic route Server component
│   │       └── MeetingPageClient.tsx  # Dynamic route Client controller
│   ├── globals.css             # Tailwind v4 custom theme styles
│   └── layout.tsx              # Root Layout, metadata, & query provider
├── components/
│   └── Providers.tsx           # TanStack Query & Sonner providers
├── features/
│   └── meet/
│   │   ├── PreJoinScreen.tsx   # Local preview and permissions UI
│   │   ├── ConferenceRoom.tsx  # Grid dashboard and control center
│   │   ├── ParticipantTile.tsx # Manual stream track binder (audio/video)
│   │   ├── ChatPanel.tsx       # Real-time chat sidebar panel
│   │   ├── ParticipantsPanel.tsx # In-call active participants roster
│   │   ├── WaitingState.tsx    # Radar animation alone state
│   │   └── LeaveConfirmModal.tsx # Confirmation dialog
├── hooks/
│   └── livekit/
│       ├── useLocalMedia.ts       # Manages previews & permissions
│       ├── useRoomConnection.ts   # Connects/disconnects LiveKit Room
│       ├── useParticipants.ts     # Monitors remote peers & active speaker
│       ├── useScreenShare.ts      # Publishes system screen share tracks
│       ├── useChat.ts             # Decodes data channel chat & hand-raises
│       └── useConnectionQuality.ts # Tracks connection signals in real-time
├── services/
│   └── livekit/
│       ├── create-room.ts      # Room creation client
│       ├── delete-room.ts      # Room deletion client
│       ├── generate-token.ts   # Participant JWT token generator
│       ├── ingress.ts          # External stream config
│       └── egress.ts           # Recording composite client
└── store/
    └── useMeetingStore.ts      # Zustand client state management
