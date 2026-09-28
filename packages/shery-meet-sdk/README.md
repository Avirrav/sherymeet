# SheryMeet Embed SDK

Embed SheryMeet video conferences in any website.

## Installation

```bash
npm install sherymeet-sdk
# or
yarn add sherymeet-sdk
# or
pnpm add sherymeet-sdk
```

### CDN (Script Tag)

```html
<script src="https://your-domain.com/sdk/shery-meet.global.js"></script>
```

## Quick Start

### ESM / TypeScript

```typescript
import { SheryMeet } from "sherymeet-sdk";

const meet = new SheryMeet({
  container: "#meeting-container",
  baseUrl: "https://meet.example.com", // Your SheryMeet server
  debug: true, // Enable console logging
});

// Join a meeting
await meet.join("room-abc123", {
  token: "eyJ...", // JWT token from your backend
  username: "John Doe",
  email: "john@example.com",
  audioEnabled: true,
  videoEnabled: true,
});

// Listen to events
meet.on("participant-joined", (participant) => {
  console.log(`${participant.name} joined!`);
});

meet.on("meeting-ended", () => {
  console.log("Meeting ended");
});
```

### Script Tag

```html
<div id="meeting" style="width: 100%; height: 600px;"></div>

<script src="https://your-domain.com/sdk/shery-meet.global.js"></script>
<script>
  const meet = new SheryMeet({
    container: "#meeting",
    baseUrl: "https://meet.example.com",
  });

  meet
    .join("room-abc123", {
      token: "your-jwt-token",
      username: "John Doe",
    })
    .then(() => {
      console.log("Joined!");
    });
</script>
```

## API Reference

### Constructor

```typescript
new SheryMeet(options: SheryMeetOptions)
```

| Option      | Type                    | Required | Description                            |
| ----------- | ----------------------- | -------- | -------------------------------------- |
| `container` | `string \| HTMLElement` | Yes      | CSS selector or element for the iframe |
| `baseUrl`   | `string`                | Yes      | SheryMeet server URL                   |
| `debug`     | `boolean`               | No       | Enable debug logging                   |

### Methods

#### Lifecycle

| Method                  | Description                             |
| ----------------------- | --------------------------------------- |
| `join(roomId, options)` | Join a meeting room. Returns a Promise. |
| `leave()`               | Leave the current meeting               |
| `endMeeting()`          | End meeting for everyone (host only)    |
| `destroy()`             | Cleanup and remove the iframe           |

#### Media Controls

| Method                        | Description                    |
| ----------------------------- | ------------------------------ |
| `toggleCamera(enabled?)`      | Toggle or set camera state     |
| `toggleMic(enabled?)`         | Toggle or set microphone state |
| `toggleScreenShare(enabled?)` | Toggle or set screen sharing   |

#### Meeting Controls

| Method                          | Description                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `sendChat(message, recipient?)` | Send chat message ("everyone" or "host")                                        |
| `raiseHand(raised?)`            | Raise or lower hand                                                             |
| `setLayout(mode)`               | Set layout: "grid", "spotlight", "sidebar", "presenter", "content-first", "pip" |
| `requestState()`                | Request current state (triggers state-changed event)                            |

#### Getters

| Method         | Returns              | Description              |
| -------------- | -------------------- | ------------------------ |
| `getState()`   | `EmbedState \| null` | Get cached meeting state |
| `getRoomId()`  | `string \| null`     | Get current room ID      |
| `getIsReady()` | `boolean`            | Check if SDK is ready    |

### Events

Subscribe with `meet.on(event, callback)`, unsubscribe with `meet.off(event, callback)`.

| Event                    | Payload                     | Description                 |
| ------------------------ | --------------------------- | --------------------------- |
| `ready`                  | -                           | SDK is ready                |
| `joined`                 | `{ roomId }`                | Successfully joined meeting |
| `left`                   | `{ roomId }`                | Left the meeting            |
| `meeting-ended`          | `{ roomId }`                | Meeting was ended           |
| `error`                  | `{ message }`               | Error occurred              |
| `participant-joined`     | `EmbedParticipant`          | Participant joined          |
| `participant-left`       | `{ participantId, name }`   | Participant left            |
| `camera-changed`         | `{ enabled }`               | Camera state changed        |
| `mic-changed`            | `{ enabled }`               | Mic state changed           |
| `screen-share-changed`   | `{ enabled }`               | Screen share changed        |
| `chat-received`          | `ChatMessage`               | New chat message            |
| `active-speaker-changed` | `{ participantId }`         | Active speaker changed      |
| `hand-raised`            | `{ participantId, raised }` | Hand raised/lowered         |
| `state-changed`          | `EmbedState`                | Full state update           |

### Types

```typescript
interface EmbedParticipant {
  id: string;
  name: string;
  isLocal: boolean;
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
}

interface EmbedState {
  isConnected: boolean;
  roomId: string | null;
  localParticipant: EmbedParticipant | null;
  participants: EmbedParticipant[];
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  layoutMode: LayoutMode;
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}

type LayoutMode = "grid" | "spotlight" | "sidebar" | "presenter" | "content-first" | "pip";
```

## Authentication

The `token` passed to `join()` must be a valid JWT issued by your backend. Contact your SheryMeet administrator for token generation endpoints.

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## License

MIT
