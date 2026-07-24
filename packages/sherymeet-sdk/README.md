# @sherymeet/embed-sdk

Embed Sherymeet video meetings in any web app. The SDK mounts the Sherymeet
meeting page in an iframe and gives you a typed event/command bridge — the
same meeting UI as the Sherymeet app, inside your product.

## How it fits together

```
Your backend  --HMAC-signed client API-->  Sherymeet server
   |  (create meet, create-start-url, join-as-user)
   |  returns startUrl / meetLink
   v
Your frontend --@sherymeet/embed-sdk-->  <iframe meet page>
```

1. **Server side** (keep your API key/secret here — never in the browser):
   call `POST /api/v1/client/meet` to create a meeting, then
   `POST /api/v1/client/meet/create-start-url` (host) or
   `POST /api/v1/client/meet/join-as-user` (participant).
   Both return a full meeting link with the token in the hash fragment.
2. **Client side**: hand that link to the SDK.

## Install

```bash
npm install @sherymeet/embed-sdk
```

Or via script tag (exposes `window.SheryMeet`):

```html
<script src="https://unpkg.com/@sherymeet/embed-sdk/dist/index.global.js"></script>
```

## Usage

```ts
import { SheryMeetEmbed } from "@sherymeet/embed-sdk";

// meetLink comes from YOUR backend, which called the Sherymeet client API.
const meeting = new SheryMeetEmbed({
  container: "#meeting",   // element or CSS selector; iframe fills it
  meetLink,
});

meeting.on("ready", () => console.log("meet page loaded"));
meeting.on("status", (s) => console.log("gate status:", s.gateStatus));
meeting.on("joined", () => console.log("user is in the room"));
meeting.on("left", () => console.log("user left the room"));
meeting.on("meeting-ended", () => {
  meeting.destroy();
});
meeting.on("error", (e) => console.error(e.message));

// Host-side controls:
meeting.leave();       // leave the room
meeting.endMeeting();  // end for everyone (requires a host token)
meeting.destroy();     // remove the iframe + listeners
```

Instead of `meetLink` you can pass the pieces:

```ts
new SheryMeetEmbed({
  container: "#meeting",
  baseUrl: "https://meet.example.com",
  roomId: "abc-defg-hij",
  token,               // from join-as-user / create-start-url
  userName: "Jordan",
});
```

## Events

| Event           | When                                                                 |
| --------------- | -------------------------------------------------------------------- |
| `ready`         | The meet page booted inside the iframe                               |
| `status`        | Gate state changed (`verifying`, `start`, `waitingHost`, `ready`, …) |
| `joined`        | The user connected to the room                                       |
| `left`          | The user disconnected from the room                                  |
| `meeting-ended` | The meeting was ended (by this user or detected as ended)            |
| `error`         | The page hit an error (invalid link, ended meeting, network)         |

## Notes

- The container should have an explicit height — the iframe fills 100% of it.
- Camera/microphone/screen-share permissions are delegated to the iframe
  automatically (`allow="camera; microphone; display-capture; …"`).
- All bridge messages are origin-checked in both directions; commands sent
  from other windows or origins are ignored by the meeting page.
- The meeting token is a credential. Fetch links from your backend at
  join time; don't store them.
