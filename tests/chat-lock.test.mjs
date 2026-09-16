import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { EventEmitter } from "node:events";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import mongoose from "mongoose";
import { AccessToken } from "livekit-server-sdk";
import { RoomEvent, ConnectionState } from "livekit-client";
import { NextRequest } from "next/server.js";
import {
  getChatSlowModeSeconds,
  isChatEnabled,
  observeChatSetting,
} from "../src/components/meet/chat-permissions.ts";
import { useChat } from "../src/hooks/media-server/useChat.ts";
import { useMeetingStore } from "../src/store/useMeetingStore.ts";

Object.assign(process.env, {
  NODE_ENV: "test",
  LIVEKIT_API_KEY: "test-key",
  LIVEKIT_API_SECRET: "test-secret-with-at-least-32-characters",
  LIVEKIT_URL: "https://livekit.example.test",
  NEXT_PUBLIC_LIVEKIT_URL: "wss://livekit.example.test",
  NEXT_PUBLIC_API_URL: "https://app.example.test",
  MONGODB_URI: "mongodb://127.0.0.1/test",
  REDIS_URL: "redis://127.0.0.1:6379",
  ENCRYPTION_MASTER_KEY: "x".repeat(32),
  LOG_LEVEL: "error",
});
global.mongooseCached = { conn: mongoose, promise: null };
global.appStoreSingleton = {
  checkRateLimit: async () => ({ allowed: true }),
};
const { chatLockHandler } = await import("../src/app/api/server/[sessionId]/chat-lock/route.ts");
const { chatSlowModeHandler } =
  await import("../src/app/api/server/[sessionId]/chat-slow-mode/route.ts");
const { RoomMember } = await import("../src/server/models/room-member.ts");
const { ConferenceRoomDao } = await import("../src/server/dao/conferenceroom-dao.ts");

async function credential(room = "room-a", admin = true, secret = process.env.LIVEKIT_API_SECRET) {
  const at = new AccessToken("test-key", secret, { identity: "host", ttl: 60 });
  at.addGrant({ roomJoin: true, roomAdmin: admin, room });
  return at.toJwt();
}
function request(token, body = { chatEnabled: false }) {
  return new NextRequest("https://app.example.test/api/server/room-a/chat-lock", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}
function slowModeRequest(token, body = { seconds: 10 }) {
  return new NextRequest("https://app.example.test/api/server/room-a/chat-slow-mode", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

test("chat lock rejects forged, cross-room, non-admin and malformed requests", async () => {
  for (const [token, body, status] of [
    [await credential("room-b"), { chatEnabled: false }, 401],
    [await credential("room-a", false), { chatEnabled: false }, 403],
    [await credential("room-a", true, "wrong-secret"), { chatEnabled: false }, 401],
    [await credential(), { chatEnabled: "false" }, 400],
    [await credential(), { chatEnabled: false, roomId: "room-b" }, 400],
  ])
    assert.equal((await chatLockHandler(request(token, body))).status, status);
});

test("even an admin grant requires current saved host membership", async () => {
  for (const role of ["co_host", "panelist", "participant", null]) {
    const stub = mock.method(RoomMember, "findOne", async () => (role ? { role } : null));
    try {
      assert.equal((await chatLockHandler(request(await credential()))).status, 403);
    } finally {
      stub.mock.restore();
    }
  }
});

test("slow mode rejects non-admin, non-host and out-of-range changes", async () => {
  assert.equal(
    (await chatSlowModeHandler(slowModeRequest(await credential("room-a", false)))).status,
    403,
  );
  assert.equal(
    (await chatSlowModeHandler(slowModeRequest(await credential(), { seconds: 301 }))).status,
    400,
  );
  const stub = mock.method(RoomMember, "findOne", async () => ({ role: "co_host" }));
  try {
    assert.equal((await chatSlowModeHandler(slowModeRequest(await credential()))).status, 403);
  } finally {
    stub.mock.restore();
  }
});

test("host toggles metadata without losing unrelated fields; malformed metadata is preserved", async () => {
  const stubs = [
    mock.method(RoomMember, "findOne", async () => ({ role: "host" })),
    mock.method(ConferenceRoomDao, "getConferenceRoom", async () => ({ status: "active" })),
  ];
  let metadata = JSON.stringify({ layout: "grid", chatEnabled: true });
  const updates = [];
  stubs.push(
    mock.method(global, "fetch", async (url, options) => {
      const body = JSON.parse(options.body);
      let result;
      if (String(url).endsWith("/ListRooms")) {
        assert.deepEqual(body.names, ["room-a"]);
        result = { rooms: [{ name: "room-a", metadata }] };
      } else if (String(url).endsWith("/UpdateRoomMetadata")) {
        updates.push({ room: body.room, ...JSON.parse(body.metadata) });
        metadata = body.metadata;
        result = { name: "room-a", metadata };
      } else {
        assert.ok(String(url).endsWith("/GetParticipant"));
        result = { identity: "host" };
      }
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  try {
    for (const enabled of [false, true]) {
      assert.equal(
        (await chatLockHandler(request(await credential(), { chatEnabled: enabled }))).status,
        200,
      );
      assert.deepEqual(updates.at(-1), { room: "room-a", layout: "grid", chatEnabled: enabled });
    }
    assert.equal(
      (await chatSlowModeHandler(slowModeRequest(await credential(), { seconds: 30 }))).status,
      200,
    );
    assert.deepEqual(updates.at(-1), {
      room: "room-a",
      layout: "grid",
      chatEnabled: true,
      chatSlowModeSeconds: 30,
    });
    metadata = "invalid";
    assert.equal((await chatLockHandler(request(await credential()))).status, 409);
    assert.equal(updates.length, 3);
    const ended = mock.method(ConferenceRoomDao, "getConferenceRoom", async () => ({
      status: "ended",
    }));
    assert.equal((await chatLockHandler(request(await credential()))).status, 409);
    ended.mock.restore();
  } finally {
    stubs.reverse().forEach((stub) => stub.mock.restore());
  }
});

test("late joins, metadata updates and reconnects synchronize chat and cleanup listeners", () => {
  const room = new EventEmitter();
  room.metadata = '{"chatEnabled":false,"chatSlowModeSeconds":10}';
  const states = [];
  const delays = [];
  const cleanup = observeChatSetting(
    room,
    (value) => states.push(value),
    (value) => delays.push(value),
  );
  assert.deepEqual(states, [false]);
  assert.deepEqual(delays, [10]);
  room.metadata = '{"chatEnabled":true,"chatSlowModeSeconds":30}';
  room.emit(RoomEvent.RoomMetadataChanged);
  room.metadata = '{"chatEnabled":false}';
  room.emit(RoomEvent.Reconnected);
  assert.deepEqual(states, [false, true, false]);
  assert.deepEqual(delays, [10, 30, 0]);
  cleanup();
  assert.equal(room.eventNames().length, 0);
  assert.equal(isChatEnabled(""), true);
  assert.equal(isChatEnabled("{}"), true);
  for (const value of ["null", "[]", "bad", '{"chatEnabled":"false"}'])
    assert.equal(isChatEnabled(value), false);
  assert.equal(getChatSlowModeSeconds('{"chatSlowModeSeconds":60}'), 60);
  assert.equal(getChatSlowModeSeconds('{"chatSlowModeSeconds":301}'), 0);
});

test("sendMessage checks current room metadata even if the hook was created before the lock", async () => {
  for (const role of ["host", "co_host", "participant", "panelist"]) {
    let chat;
    let publishes = 0;
    const room = {
      state: ConnectionState.Connected,
      metadata: "{}",
      localParticipant: {
        identity: role,
        name: role,
        metadata: JSON.stringify({ participant: { role } }),
        publishData: async () => {
          publishes++;
        },
      },
    };
    function Harness() {
      chat = useChat(room);
      return null;
    }
    renderToStaticMarkup(React.createElement(Harness));
    room.metadata = '{"chatEnabled":false}';
    assert.equal(await chat.sendMessage("locked"), role === "host");
    assert.equal(publishes, role === "host" ? 1 : 0);
    room.metadata = '{"chatEnabled":true}';
    assert.equal(await chat.sendMessage("open"), true);
    assert.equal(publishes, role === "host" ? 2 : 1);
  }
});

test("host-only messages target every host and exclude co-hosts and participants", async () => {
  let chat;
  let published;
  const remote = (identity, role) => ({
    identity,
    name: identity,
    metadata: JSON.stringify({ participant: { role } }),
  });
  const room = {
    state: ConnectionState.Connected,
    metadata: "{}",
    localParticipant: {
      identity: "viewer",
      name: "Viewer",
      metadata: JSON.stringify({ participant: { role: "participant" } }),
      publishData: async (data, options) => {
        published = { data: JSON.parse(new TextDecoder().decode(data)), options };
      },
    },
    remoteParticipants: new Map([
      ["host-one", remote("host-one", "host")],
      ["co-host", remote("co-host", "co_host")],
      ["host-two", remote("host-two", "host")],
      ["viewer-two", remote("viewer-two", "participant")],
    ]),
  };
  function Harness() {
    chat = useChat(room);
    return null;
  }
  renderToStaticMarkup(React.createElement(Harness));
  assert.equal(await chat.sendMessage("private", "host"), true);
  assert.deepEqual(published.options, {
    reliable: true,
    destinationIdentities: ["host-one", "host-two"],
  });
  assert.deepEqual(published.data.payload, { text: "private", recipient: "host" });
});

test("host-only message is not published when no host is connected", async () => {
  let chat;
  let publishes = 0;
  const room = {
    state: ConnectionState.Connected,
    metadata: "{}",
    localParticipant: {
      identity: "viewer",
      name: "Viewer",
      metadata: JSON.stringify({ participant: { role: "participant" } }),
      publishData: async () => {
        publishes++;
      },
    },
    remoteParticipants: new Map(),
  };
  function Harness() {
    chat = useChat(room);
    return null;
  }
  renderToStaticMarkup(React.createElement(Harness));
  assert.equal(await chat.sendMessage("private", "host"), false);
  assert.equal(publishes, 0);
});

test("slow mode blocks repeated participant messages and exempts the host", async () => {
  for (const role of ["participant", "host"]) {
    useMeetingStore.setState({ lastChatSentAt: 0 });
    let chat;
    let publishes = 0;
    const room = {
      state: ConnectionState.Connected,
      metadata: '{"chatSlowModeSeconds":10}',
      localParticipant: {
        identity: role,
        name: role,
        metadata: JSON.stringify({ participant: { role } }),
        publishData: async () => {
          publishes++;
        },
      },
      remoteParticipants: new Map(),
    };
    function Harness() {
      chat = useChat(room);
      return null;
    }
    renderToStaticMarkup(React.createElement(Harness));
    assert.equal(await chat.sendMessage("first"), true);
    assert.equal(await chat.sendMessage("second"), role === "host");
    assert.equal(publishes, role === "host" ? 2 : 1);
  }
});
