# SheryMeet Embed SDK — Integration Guide

Embed the full SheryMeet meeting experience — pre-join screen, conference room, chat, participants, screen share, live captions — inside your own web app using **`@sherymeet/embed-sdk`**.

This guide covers the complete integration: backend, frontend, events, and a working end-to-end example. For the raw HTTP API reference (signature algorithm, endpoint schemas), see the [Client API Documentation](client_api_documentation.md).

---

## 1. How It Works

The SDK does **not** talk to LiveKit or the SheryMeet API directly. It mounts the SheryMeet meeting page in an iframe and communicates with it over a secure, origin-checked `postMessage` bridge.

```
┌────────────────┐   1. HMAC-signed API calls    ┌───────────────────┐
│  Your backend  │ ────────────────────────────► │  SheryMeet server │
│ (holds secret) │ ◄──────────────────────────── │                   │
└──────┬─────────┘    returns meetLink/startUrl  └───────────────────┘
       │ 2. meetLink
       ▼
┌────────────────┐   3. iframe + postMessage     ┌───────────────────┐
│ Your frontend  │ ────────────────────────────► │  SheryMeet meet   │
│  (embed SDK)   │ ◄──── events / commands ────► │  page (iframe)    │
└────────────────┘                               └───────────────────┘
```

**Division of responsibility:**

| Where | What happens there | What must never happen there |
| :--- | :--- | :--- |
| Your **backend** | Signs requests with your API key/secret; creates meetings; fetches `startUrl`/`meetLink` | — |
| Your **frontend** | Passes the link to the SDK; reacts to events | Holding the API key or secret |

---

## 2. Prerequisites

1. A SheryMeet **API client** (API key + secret) with the permissions you need:
   - `createMeeting` — create meetings and host start-URLs
   - `joinMeeting` — issue participant join links
   - `endMeeting` — end meetings from your backend
   - `allowRecording` capability — if you want cloud recording
2. Your backend implements the **HMAC signature scheme** (copy-paste helper in the [API docs, §2](client_api_documentation.md)).
3. A container element in your UI with an explicit height — the meeting iframe fills 100% of it.

---

## 3. Install

```bash
npm install @sherymeet/embed-sdk
# or
pnpm add @sherymeet/embed-sdk
```

Or with a script tag (exposes `window.SheryMeet`):

```html
<script src="https://unpkg.com/@sherymeet/embed-sdk/dist/index.global.js"></script>
```

TypeScript definitions are bundled — no `@types` package needed.

---

## 4. Backend: Obtain a Meeting Link

Your backend calls the SheryMeet client API (all requests HMAC-signed):

```js
// Using the generateHeaders() helper from the API docs §2
const BASE = process.env.SHERYMEET_BASE_URL;

async function callSheryMeet(path, body) {
  const headers = generateHeaders({
    method: "POST",
    host: new URL(BASE).host,
    path,
    body,
    apiKey: process.env.SHERYMEET_API_KEY,
    clientSecret: process.env.SHERYMEET_CLIENT_SECRET,
  });
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

// 1. Create a meeting (once, when the session is scheduled)
const created = await callSheryMeet("/api/v1/client/meet", {
  passcode: "123456",
  type: "meet",          // or "webinar"
  isRecording: false,
});
const roomId = created.data.roomName; // e.g. "abc-defg-hij"

// 2a. Host link — full moderator control (start meeting, end, recording)
const host = await callSheryMeet("/api/v1/client/meet/create-start-url", {
  roomId,
  passcode: "123456",
});
const startUrl = host.data.startUrl;

// 2b. Participant link — publish/subscribe only
const user = await callSheryMeet("/api/v1/client/meet/join-as-user", {
  roomId,
  passcode: "123456",
  participantData: { name: "Jordan", role: "participant" },
});
const meetLink = user.data.meetLink;
```

> [!IMPORTANT]
> Links carry the access token in the **hash fragment** (`#token=...`) and expire (2 hours by default). Generate them **at join time**, per user — don't create them in advance, store them, or share one link between users.

---

## 5. Frontend: Embed the Meeting

```html
<div id="meeting" style="height: 100vh"></div>
```

```ts
import { SheryMeetEmbed } from "@sherymeet/embed-sdk";

// meetLink came from YOUR backend (step 4) — e.g. via your own /api/join endpoint
const meeting = new SheryMeetEmbed({
  container: "#meeting",   // element or CSS selector
  meetLink,
});

meeting.on("ready", () => {
  console.log("Meeting page loaded");
});

meeting.on("status", ({ gateStatus }) => {
  // 'verifying' | 'start' | 'waitingHost' | 'ready' | 'noAccess' | 'error'
  console.log("Gate status:", gateStatus);
});

meeting.on("joined", () => {
  console.log("User is in the room");
});

meeting.on("left", () => {
  console.log("User left the room");
  meeting.destroy(); // e.g. return to your own UI
});

meeting.on("meeting-ended", () => {
  meeting.destroy();
});

meeting.on("error", ({ message }) => {
  console.error("Meeting error:", message);
});
```

Instead of a full link you can pass the pieces:

```ts
new SheryMeetEmbed({
  container: "#meeting",
  baseUrl: "https://meet.yourdomain.com",
  roomId: "abc-defg-hij",
  token,                 // from create-start-url / join-as-user
  userName: "Jordan",
});
```

### Constructor options

| Option | Type | Description |
| :--- | :--- | :--- |
| `container` | `HTMLElement \| string` | Where the iframe mounts. **Required.** |
| `meetLink` | `string` | Full link from the client API. Use this **or** the three below. |
| `baseUrl` | `string` | SheryMeet deployment origin. |
| `roomId` | `string` | Room ID (`abc-defg-hij`). |
| `token` | `string` | Room token from the client API. |
| `userName` | `string` | Display name prefilled on the pre-join screen. |
| `email` | `string` | Optional email forwarded to the page. |
| `iframeClassName` | `string` | Extra CSS class for the iframe element. |

### Methods

| Method | Description |
| :--- | :--- |
| `on(event, handler)` | Subscribe to an event. Returns an unsubscribe function. |
| `off(event, handler)` | Remove a handler. |
| `leave()` | Disconnect the user from the room. |
| `endMeeting()` | End the meeting for everyone. Only works with a **host** token — the server re-verifies the token's admin grant, so calling it with a participant token does nothing. |
| `destroy()` | Remove the iframe and all listeners. The instance cannot be reused. |

### Events

| Event | Fires when | Payload |
| :--- | :--- | :--- |
| `ready` | The meet page booted inside the iframe | — |
| `status` | The page's gate state changed | `{ gateStatus, roomId, message? }` |
| `joined` | The user connected to the room | `{ roomId }` |
| `left` | The user disconnected | `{ roomId }` |
| `meeting-ended` | The meeting ended (by this user, the host, or detected as already ended) | `{ roomId }` |
| `error` | Invalid/expired link, ended meeting, or network failure | `{ message }` |

---

## 6. The User Flows You Get for Free

**Host** (link from `create-start-url`):
1. Page verifies the token → shows **"Start Meeting"**.
2. Host clicks start → LiveKit room is created, recording begins (if enabled).
3. Pre-join screen (camera/mic preview) → conference room.

**Participant** (link from `join-as-user`):
1. Page verifies the token.
2. If the host hasn't started yet → **"Waiting for the host"** screen that polls and lets them in automatically the moment the meeting goes active. Your embed just works — no polling code on your side.
3. Pre-join screen → conference room.

Both flows emit `status` events at every step, so your UI can react (show a spinner, swap views, etc.).

---

## 7. Complete Minimal Example

**Backend (Express):**

```js
import express from "express";
// generateHeaders() from the API docs §2

const app = express();

app.post("/api/lessons/:id/join", async (req, res) => {
  const lesson = await db.lessons.get(req.params.id); // your data
  const result = await callSheryMeet("/api/v1/client/meet/join-as-user", {
    roomId: lesson.sheryMeetRoomId,
    passcode: lesson.passcode,
    participantData: { name: req.user.displayName, role: "participant" },
  });
  if (!result.success) return res.status(502).json({ error: "Could not join" });
  res.json({ meetLink: result.data.meetLink });
});

app.listen(4000);
```

**Frontend:**

```html
<!doctype html>
<div id="meeting" style="height: 100vh"></div>
<script src="https://unpkg.com/@sherymeet/embed-sdk/dist/index.global.js"></script>
<script>
  async function joinLesson(lessonId) {
    const res = await fetch(`/api/lessons/${lessonId}/join`, { method: "POST" });
    const { meetLink } = await res.json();

    const meeting = new SheryMeet.SheryMeetEmbed({
      container: "#meeting",
      meetLink,
    });
    meeting.on("meeting-ended", () => {
      meeting.destroy();
      location.href = "/lessons/" + lessonId + "/summary";
    });
  }
  joinLesson("lesson-42");
</script>
```

---

## 8. Security Model

- **The token is the credential.** Everything else (iframe origin checks, message filtering) is defense in depth. A leaked link is a usable link until the token expires — treat links like passwords.
- **Origin-checked in both directions.** The SDK only accepts messages from your SheryMeet deployment's origin coming from its own iframe; the meet page pins the embedding origin during an init handshake and ignores commands from anywhere else.
- **Nothing sensitive crosses the bridge.** Events carry only room IDs and state strings.
- **Media permissions** are delegated to the iframe automatically (`allow="camera; microphone; display-capture; autoplay; ..."`) — you don't need to configure anything, but the *embedding page* must be served over **HTTPS** for the browser to grant camera/mic access at all.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
| :--- | :--- |
| Iframe renders with zero height | The container has no explicit height. Give it `height: 100vh` (or any fixed/flex height). |
| Camera/mic prompt never appears | Embedding page is on plain HTTP. Serve your app over HTTPS (localhost is exempt). |
| "You don't have access to this meeting" | The link is missing its `#token=...` fragment — it was truncated somewhere (some chat apps strip fragments). Regenerate and pass the full URL. |
| "This meeting has already ended" | Meeting was ended, or the link is stale. Create a new meeting / fetch a fresh link. |
| `joined` never fires | User is still on the pre-join screen, or the host hasn't started the meeting (check `status` events for `waitingHost`). |
| `endMeeting()` does nothing | The embedded user has a participant token. Only host tokens (from `create-start-url`) can end meetings. |
| Events stop after a reload of your page | Each `SheryMeetEmbed` instance binds to one iframe. Recreate the instance (and fetch a fresh link) after navigation. |

---

## 10. Versioning

The bridge protocol is versioned (`v: 1`). Messages with an unknown version are ignored by both sides, so future SheryMeet upgrades won't break existing embeds — you'll just miss new event types until you update the SDK package.
