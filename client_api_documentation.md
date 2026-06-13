# SheryMeet Client Integration API Documentation

This document describes how client applications authenticate and interact with SheryMeet's private HTTP API endpoints.

---

## 1. Environment & Base URL Configuration

Before calling the APIs, the client must configure the following environment variables in their backend service's `.env` configuration file:

```env
# SheryMeet Integration Credentials
SHERYMEET_API_KEY=sm_live_your_actual_api_key_here
SHERYMEET_CLIENT_SECRET=sm_sec_your_actual_plaintext_secret_here

# SheryMeet API Base URL
# Development URL: http://localhost:3000
# Production URL:  https://your-backend-domain.com
SHERYMEET_BASE_URL=http://localhost:3000
```

> [!IMPORTANT]
> All endpoints documented below are relative to your configured `SHERYMEET_BASE_URL`. For example, `POST /api/v1/client/meet` maps to `${SHERYMEET_BASE_URL}/api/v1/client/meet`.
> Never leak `SHERYMEET_CLIENT_SECRET` to frontend client code.

---

## 2. Authentication & Security

All API endpoints are protected by an HMAC-SHA256 signature validation middleware stack. Requests must carry correct cryptographic tracking headers to successfully pass validation.

### Request Headers
Every request must include the following headers:

| Header Name | Required | Description |
| :--- | :--- | :--- |
| `x-request-id` | Yes | A unique string (e.g., UUID) to track and trace logs for this request. |
| `x-api-key` | Yes | Your client API Key (e.g., `sm_live_...`). |
| `x-timestamp` | Yes | The current Unix epoch time in seconds (e.g., `1781254395`). Request drift must be within ±300 seconds (5 minutes) of the server time. |
| `x-nonce` | Yes | A unique string (e.g., UUID) that acts as a single-use token to prevent replay attacks. |
| `x-signature-version` | Yes | Must be set to `v1`. |
| `x-signature` | Yes | The calculated HMAC-SHA256 signature of the canonical payload, signed using your plaintext client secret. |
| `Origin` | Optional | Whitelisted origin header if domain restrictions are configured. |

---

### Signature Generation Algorithm

To calculate the `x-signature` header:

1. **Calculate the Body Hash**:
   * If there is no request body, `BODY_HASH` is the SHA-256 hash of an empty string.
   * If there is a JSON body, sort the object keys recursively in alphabetical order, stringify it, and compute the SHA-256 hash.

2. **Construct the Canonical Payload**:
   Join the following parameters exactly in order using a newline (`\n`) separator:
   ```text
   HTTP_METHOD
   HOST
   PATH
   CANONICAL_QUERY_STRING
   TIMESTAMP
   NONCE
   BODY_HASH
   ORIGIN
   ```
   * *Note: `CANONICAL_QUERY_STRING` is the query parameters sorted alphabetically and URL-encoded. If none exist, use an empty string.*
   * *Note: If `ORIGIN` is not present, use an empty string.*

   #### Canonical Payload Fields Breakdown:
   * **`HTTP_METHOD`**: The uppercase name of the HTTP action being performed (e.g., `POST`, `GET`). Binds the signature to a specific HTTP verb to prevent replaying a safe GET request as a state-changing POST/DELETE request.
   * **`HOST`**: The hostname of the target server (e.g., `api.sherymeet.com` or `localhost:3000`). Prevents request redirection and DNS-rebinding attacks.
   * **`PATH`**: The absolute URL path of the request starting with `/` (e.g., `/api/v1/client/meet/join-as-host`). Binds the signature to a specific endpoint so a signature for one route cannot be reused for another.
   * **`CANONICAL_QUERY_STRING`**: Alphabetically sorted and URL-encoded query parameters (e.g., `limit=10&offset=20`). If no parameters exist, use an empty string (`""`). Prevents parameters from being injected or altered.
   * **`TIMESTAMP`**: The current Unix epoch time in seconds matching the `x-timestamp` header (e.g., `1781254395`). Prevents replay attacks by restricting request validity to a 5-minute (±300 seconds) window.
   * **`NONCE`**: A unique, single-use random string matching the `x-nonce` header (e.g., `a4f3b26c-8e1d-4f7a-9a8b-3c2d1e0f9a8b`). Prevents replay attacks within the 5-minute validity window since duplicate nonces are rejected.
   * **`BODY_HASH`**: The SHA-256 hash in hexadecimal format of the alphabetically sorted and stringified JSON request body (e.g., `cb9c7be77e3848b53cf2c99a0e668e14620f3246ebc6df710bd8b4a233b47c0d`). If there is no request body, use the SHA-256 hash of an empty string (`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`). Guarantees that the payload body cannot be altered in transit.
   * **`ORIGIN`**: The value of the browser `Origin` or `Referer` header (e.g., `https://app.sherymeet.com`). If not present (e.g., in server-to-server calls), use an empty string (`""`). Prevents cross-origin signature hijacking.

3. **Compute the Signature**:
   Sign the canonical payload with the plaintext `clientSecret` using **HMAC-SHA256** in hex format.

#### Example Signature Code (Node.js)
```javascript
const crypto = require("crypto");

function generateHeaders({ method, host, path, query = "", body, apiKey, clientSecret }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const requestId = "client_" + crypto.randomBytes(8).toString("hex");

  // 1. Compute Body Hash
  let bodyHash = crypto.createHash("sha256").update("").digest("hex");
  if (body) {
    // Basic key sorting for JSON bodies
    const sortKeys = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(sortKeys);
      return Object.keys(obj).sort().reduce((acc, key) => {
        acc[key] = sortKeys(obj[key]);
        return acc;
      }, {});
    };
    const canonicalBody = JSON.stringify(sortKeys(body));
    bodyHash = crypto.createHash("sha256").update(canonicalBody, "utf8").digest("hex");
  }

  // 2. Build Payload
  const payload = [
    method.toUpperCase(),
    host,
    path,
    query,
    timestamp,
    nonce,
    bodyHash,
    "" // Empty origin for server-to-server calls
  ].join("\n");

  // 3. Sign Payload
  const signature = crypto
    .createHmac("sha256", clientSecret)
    .update(payload, "utf8")
    .digest("hex");

  return {
    "Content-Type": "application/json",
    "x-request-id": requestId,
    "x-api-key": apiKey,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-signature-version": "v1",
    "x-signature": signature
  };
}
```

---

## 3. API Reference

### 1. Create Meeting
Initializes a scheduled room in the MongoDB database. This does not instantiate LiveKit rooms or generate dynamic joining tokens.

* **HTTP Method**: `POST`
* **URL**: `/api/v1/client/meet`
* **Permissions Required**: `createMeeting`

#### Request Body
```json
{
  "host": {
    "_id": "647bdf2f91a7e4b9e4a3b6f1",
    "userName": "Gourav Host",
    "role": "mentor",
    "email": "host@example.com"
  },
  "passcode": "secure_room_passcode_123"
}
```

#### Response (200 OK)
Returns clean sharing links (host and participant) that you can distribute to users.
```json
{
  "statusCode": 200,
  "data": {
    "roomName": "abc-defg-hij",
    "hostLink": "https://api.sherymeet.com/meet/abc-defg-hij?userName=Gourav Host",
    "participantLink": "https://api.sherymeet.com/meet/abc-defg-hij",
    "meet": {
      "_id": "647bdf2f91a...",
      "roomId": "abc-defg-hij",
      "roomCode": "abc-defg-hij",
      "status": "scheduled",
      "startedAt": null,
      "endedAt": null,
      "host": {
        "userId": "647bdf2f9...",
        "username": "Gourav Host"
      }
    }
  },
  "message": "Meeting generated successfully",
  "success": true
}
```

---

### 2. Join Meeting as Host (Start Meeting)
Verifies client hierarchy, updates meeting status to `"active"`, spawns a LiveKit room, starts recording if enabled, and generates a connection token with full **Host permissions** (e.g. mute participants, start/stop recording, eject users).

* **HTTP Method**: `POST`
* **URL**: `/api/v1/client/meet/join-as-host`
* **Permissions Required**: `startMeeting`, `joinMeeting`

#### Request Body
```json
{
  "roomId": "abc-defg-hij",
  "user": {
    "_id": "647bdf2f91a7e4b9e4a3b6f1",
    "userName": "Gourav Host",
    "role": "mentor",
    "email": "host@example.com"
  },
  "passcode": "secure_room_passcode_123"
}
```

#### Response (200 OK)
Returns a LiveKit WebSocket URL and a signed JWT containing **host/admin grants**. The returned `meetLink` has the token appended as a hash.
```json
{
  "statusCode": 200,
  "data": {
    "token": "eyJhbGciOi...",
    "roomId": "abc-defg-hij",
    "serverUrl": "wss://livekit.sherymeet.com",
    "meetLink": "https://api.sherymeet.com/meet/abc-defg-hij?token=eyJhbGciOi..."
  },
  "message": "Room created successfully, Meeting started.",
  "success": true
}
```

---

### 3. Join Meeting as User (Participant Join)
Checks if the meeting has been started by the host, checks the passcode, and returns a LiveKit connection token with **standard participant grants** (read/write feeds, no moderator controls).

* **HTTP Method**: `POST`
* **URL**: `/api/v1/client/meet/join-as-user`
* **Permissions Required**: `joinMeeting`

#### Request Body
```json
{
  "roomId": "abc-defg-hij",
  "user": {
    "_id": "647bdf2f91a7e4b9e4a3b6f2",
    "userName": "Student User",
    "role": "student",
    "email": "student@example.com"
  }
}
```

#### Response (200 OK)
Returns a LiveKit connection token with **participant grants** and a join URL.
```json
{
  "statusCode": 200,
  "data": {
    "token": "eyJhbGciOi...",
    "roomId": "abc-defg-hij",
    "serverUrl": "wss://livekit.sherymeet.com",
    "meetLink": "https://api.sherymeet.com/meet/abc-defg-hij?token=eyJhbGciOi..."
  },
  "message": "Joined meeting successfully.",
  "success": true
}
```

---

### 4. End Meeting
Updates the meeting status in the database to `"ended"`, stops any active recordings, and destroys the room on the LiveKit server.

* **HTTP Method**: `POST`
* **URL**: `/api/v1/client/meet/end-meet`
* **Permissions Required**: `endMeeting`, `deleteMeeting`

#### Request Body
```json
{
  "roomId": "abc-defg-hij"
}
```

#### Response (200 OK)
```json
{
  "statusCode": 200,
  "data": {
    "meet": {
      "_id": "647bdf2f91a...",
      "roomId": "abc-defg-hij",
      "status": "ended"
    }
  },
  "message": "Meeting ended successfully.",
  "success": true
}
```

---

## 4. Important Safety Guidelines for Clients
1. **Passcode & Tokens**: Keep both the `meetLink` values returned by the endpoints secure. The token in the link expires based on LiveKit token policies, so they should be fetched dynamically when users join a room.
2. **Access Separation**:
   * Distribute the token generated from `join-as-host` **only** to the instructor/host. It gives full room moderator control.
   * Distribute the token generated from `join-as-user` to standard attendees. It strictly limits their permissions to publishing and subscribing to streams.
