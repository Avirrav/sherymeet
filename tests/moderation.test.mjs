import assert from "node:assert/strict";
import { test, mock } from "node:test";
import mongoose from "mongoose";
import { AccessToken, TokenVerifier, TrackSource, LiveKitAPI } from "livekit-server-sdk";
import { NextRequest } from "next/server.js";

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
  checkRateLimit: async () => ({ allowed: true, remaining: 29, reset: 60 }),
};
const { participantGrants } = await import("../src/server/services/livekit/participant-grants.ts");
const { ParticipantRole: Role } = await import("../src/types/roles.ts");
const { verifyRoomToken } = await import("../src/server/services/livekit/verify-room-token.ts");
const { RoomMember } = await import("../src/server/models/room-member.ts");

async function token(
  role = Role.HOST,
  room = "room-a",
  identity = "host",
  secret = process.env.LIVEKIT_API_SECRET,
) {
  const at = new AccessToken("test-key", secret, {
    identity,
    ttl: 60,
    name: identity,
    metadata: JSON.stringify({ participant: { name: identity, role } }),
  });
  at.addGrant(participantGrants(room, role, true));
  return at.toJwt();
}

test("panelists publish mic/camera without admin or metadata authority", () => {
  const grants = participantGrants("room-a", Role.PANELIST, true);
  assert.equal(grants.roomAdmin, false);
  assert.equal(grants.canPublish, true);
  assert.equal(grants.canUpdateOwnMetadata, false);
  assert.deepEqual(grants.canPublishSources, [TrackSource.MICROPHONE, TrackSource.CAMERA]);
  assert.equal(participantGrants("room-a", Role.PARTICIPANT, true).canPublish, false);
  assert.equal(participantGrants("room-a", Role.PARTICIPANT, false).canPublish, true);
});

test("room authentication rejects forged and cross-room tokens", async () => {
  await assert.rejects(verifyRoomToken(await token(Role.HOST, "room-b"), "room-a"));
  await assert.rejects(
    verifyRoomToken(await token(Role.HOST, "room-a", "host", "wrong-secret"), "room-a"),
  );
  assert.equal((await verifyRoomToken(await token(), "room-a")).roomAdmin, true);
  assert.equal((await verifyRoomToken(await token(Role.PANELIST), "room-a")).roomAdmin, false);
});

test("old panel token rejoins as saved audience without extending expiry", async () => {
  const { refreshRoomToken } = await import("../src/server/services/livekit/refresh-room-token.ts");
  const stub = mock.method(RoomMember, "findOne", async () => ({
    identity: "viewer",
    name: "Viewer",
    role: Role.PARTICIPANT,
    lockUntil: new Date(0),
  }));
  try {
    const original = await token(Role.PANELIST, "room-a", "viewer");
    const verified = await verifyRoomToken(original, "room-a");
    const refreshed = await refreshRoomToken(original, verified, "room-a", true);
    const claims = await new TokenVerifier("test-key", process.env.LIVEKIT_API_SECRET).verify(
      refreshed,
    );
    assert.equal(claims.sub, "viewer");
    assert.equal(claims.video.canPublish, false);
    assert.equal(claims.video.roomAdmin, false);
    assert.ok(claims.exp <= verified.claims.exp);
  } finally {
    stub.mock.restore();
  }
});

test("panel endpoint denies viewer, cross-room, self-target and arbitrary permission requests", async () => {
  const { panelHandler } =
    await import("../src/app/api/server/[sessionId]/participants/panel/route.ts");
  for (const [credential, body, status] of [
    [await token(Role.PARTICIPANT), { identity: "viewer", onPanel: true }, 403],
    [await token(Role.HOST, "room-b"), { identity: "viewer", onPanel: true }, 401],
    [await token(), { identity: "host", onPanel: true }, 403],
    [await token(), { identity: "viewer", onPanel: true, roomAdmin: true }, 400],
  ]) {
    const response = await panelHandler(
      new NextRequest("https://app.example.test/api/server/room-a/participants/panel", {
        method: "POST",
        headers: { Authorization: `Bearer ${credential}` },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(response.status, status);
  }
});

test("panel endpoint saves role, restricts sources and releases lock after LiveKit failure", async () => {
  const { panelHandler } =
    await import("../src/app/api/server/[sessionId]/participants/panel/route.ts");
  const { ConferenceRoomDao } = await import("../src/server/dao/conferenceroom-dao.ts");
  let updateBody;
  const stubs = [
    mock.method(ConferenceRoomDao, "getConferenceRoom", async () => ({
      type: "webinar",
      status: "active",
    })),
    mock.method(RoomMember, "findOne", async (query) => ({
      name: query.identity,
      role: query.identity === "host" ? Role.HOST : Role.PARTICIPANT,
      lockUntil: new Date(0),
    })),
    mock.method(RoomMember, "findOneAndUpdate", async () => ({ role: Role.PANELIST })),
    mock.method(RoomMember, "updateOne", async () => ({})),
    mock.method(global, "fetch", async (url, options) => {
      const body = JSON.parse(options.body);
      if (String(url).endsWith("/UpdateParticipant")) {
        updateBody = body;
        throw new Error("network timeout");
      }
      return new Response(JSON.stringify({ identity: body.identity }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  ];
  try {
    const response = await panelHandler(
      new NextRequest("https://app.example.test/api/server/room-a/participants/panel", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ identity: "viewer", onPanel: true }),
      }),
    );
    assert.equal(response.status, 502);
    assert.equal(stubs[2].mock.callCount(), 1);
    assert.equal(stubs[3].mock.callCount(), 1);
    assert.equal(updateBody.permission.canPublish, true);
    assert.deepEqual(updateBody.permission.canPublishSources, ["MICROPHONE", "CAMERA"]);
    assert.notEqual(updateBody.permission.canUpdateMetadata, true);
  } finally {
    stubs.forEach((stub) => stub.mock.restore());
  }
});

test("browser SDK sends the supplied admin token and target to LiveKit", async () => {
  let request;
  const stub = mock.method(global, "fetch", async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ track: { sid: "TR_mic", muted: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  try {
    const api = new LiveKitAPI({
      host: "https://livekit.example.test",
      token: "signed-admin-token",
    });
    await api.room.mutePublishedTrack("room-a", "viewer", "TR_mic", true);
    assert.equal(request.options.headers.Authorization, "Bearer signed-admin-token");
    const body = JSON.parse(request.options.body);
    assert.equal(body.room, "room-a");
    assert.equal(body.identity, "viewer");
    assert.equal(body.muted, true);
  } finally {
    stub.mock.restore();
  }
});

test("attendee token generation cannot reuse an admin identity with the same email", async () => {
  const { generateToken } = await import("../src/server/services/livekit/generate-token.ts");
  const { ConferenceRoomDao } = await import("../src/server/dao/conferenceroom-dao.ts");
  let lookup;
  const stubs = [
    mock.method(ConferenceRoomDao, "getConferenceRoom", async () => ({
      type: "webinar",
      status: "active",
    })),
    mock.method(RoomMember, "findOne", async (query) => {
      lookup = query;
      return null;
    }),
    mock.method(RoomMember, "findOneAndUpdate", async (_query, update) => ({
      ...update.$setOnInsert,
      lockUntil: new Date(0),
    })),
  ];
  try {
    const jwt = await generateToken({
      roomId: "room-a",
      participant: { name: "Viewer", email: "same@example.test", role: Role.PARTICIPANT },
    });
    const claims = await new TokenVerifier("test-key", process.env.LIVEKIT_API_SECRET).verify(jwt);
    assert.deepEqual(lookup.role.$in, [Role.PARTICIPANT, Role.PANELIST]);
    assert.equal(claims.video.roomAdmin, false);
    assert.equal(claims.video.canPublish, false);
  } finally {
    stubs.forEach((stub) => stub.mock.restore());
  }
});

test("expired credentials cannot authorize the panel API", async () => {
  const at = new AccessToken("test-key", process.env.LIVEKIT_API_SECRET, {
    identity: "host",
    ttl: -120,
  });
  at.addGrant(participantGrants("room-a", Role.HOST, true));
  await assert.rejects(verifyRoomToken(await at.toJwt(), "room-a"));
});

test("audience microphone permission never grants panel, camera, screen share or admin rights", () => {
  const grants = participantGrants("room-a", Role.PARTICIPANT, true, true);
  assert.equal(grants.canPublish, true);
  assert.equal(grants.roomAdmin, false);
  assert.equal(grants.canUpdateOwnMetadata, false);
  assert.deepEqual(grants.canPublishSources, [TrackSource.MICROPHONE]);
});

test("saved microphone access survives a rejoin without promoting the audience member", async () => {
  const { refreshRoomToken } = await import("../src/server/services/livekit/refresh-room-token.ts");
  const stub = mock.method(RoomMember, "findOne", async () => ({
    name: "Viewer",
    role: Role.PARTICIPANT,
    microphoneAllowed: true,
    lockUntil: new Date(0),
  }));
  try {
    const original = await token(Role.PARTICIPANT, "room-a", "viewer");
    const verified = await verifyRoomToken(original, "room-a");
    const refreshed = await refreshRoomToken(original, verified, "room-a", true);
    const claims = await new TokenVerifier("test-key", process.env.LIVEKIT_API_SECRET).verify(
      refreshed,
    );
    assert.equal(claims.sub, "viewer");
    assert.equal(JSON.parse(claims.metadata).participant.role, Role.PARTICIPANT);
    assert.equal(claims.video.canPublish, true);
    assert.equal(claims.video.roomAdmin, false);
    assert.deepEqual(claims.video.canPublishSources, ["microphone"]);
    assert.ok(claims.exp <= verified.claims.exp);
  } finally {
    stub.mock.restore();
  }
});

test("microphone endpoint rejects audience and cross-room admin credentials", async () => {
  const { microphoneHandler } =
    await import("../src/app/api/server/[sessionId]/participants/microphone/route.ts");
  for (const [credential, status] of [
    [await token(Role.PARTICIPANT), 403],
    [await token(Role.HOST, "room-b"), 401],
  ]) {
    const response = await microphoneHandler(
      new NextRequest("https://app.example.test/api/server/room-a/participants/microphone", {
        method: "POST",
        headers: { Authorization: `Bearer ${credential}` },
        body: JSON.stringify({ identity: "viewer" }),
      }),
    );
    assert.equal(response.status, status);
  }
});

test("granting microphone and removing panel preserve independent audio-only audience access", async () => {
  const { microphoneHandler } =
    await import("../src/app/api/server/[sessionId]/participants/microphone/route.ts");
  const { panelHandler } =
    await import("../src/app/api/server/[sessionId]/participants/panel/route.ts");
  const { ConferenceRoomDao } = await import("../src/server/dao/conferenceroom-dao.ts");
  for (const kind of ["microphone", "panel"]) {
    let storedUpdate;
    let liveUpdate;
    const before = {
      name: "Viewer",
      role: kind === "microphone" ? Role.PARTICIPANT : Role.PANELIST,
      microphoneAllowed: kind === "panel",
      lockUntil: new Date(0),
    };
    const stubs = [
      mock.method(ConferenceRoomDao, "getConferenceRoom", async () => ({
        type: "webinar",
        status: "active",
      })),
      mock.method(RoomMember, "findOne", async (query) =>
        query.identity === "host" ? { role: Role.HOST } : before,
      ),
      mock.method(RoomMember, "findOneAndUpdate", async (_query, update) => {
        storedUpdate = update.$set;
        return { ...before, ...update.$set };
      }),
      mock.method(RoomMember, "updateOne", async () => ({})),
      mock.method(global, "fetch", async (url, options) => {
        const body = JSON.parse(options.body);
        if (String(url).endsWith("/UpdateParticipant")) liveUpdate = body;
        return new Response(JSON.stringify({ identity: body.identity }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    ];
    try {
      const request = new NextRequest(
        `https://app.example.test/api/server/room-a/participants/${kind}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${await token()}` },
          body: JSON.stringify(
            kind === "microphone" ? { identity: "viewer" } : { identity: "viewer", onPanel: false },
          ),
        },
      );
      const response = await (kind === "microphone" ? microphoneHandler : panelHandler)(request);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.data.role, Role.PARTICIPANT);
      assert.equal(result.data.microphoneAllowed, true);
      if (kind === "microphone") {
        assert.equal(storedUpdate.microphoneAllowed, true);
        assert.equal(storedUpdate.role, undefined);
      } else {
        assert.equal(storedUpdate.role, Role.PARTICIPANT);
        assert.equal(storedUpdate.microphoneAllowed, undefined);
      }
      assert.equal(JSON.parse(liveUpdate.metadata).participant.role, Role.PARTICIPANT);
      assert.equal(liveUpdate.permission.canPublish, true);
      assert.deepEqual(liveUpdate.permission.canPublishSources, ["MICROPHONE"]);
      assert.notEqual(liveUpdate.permission.canUpdateMetadata, true);
    } finally {
      stubs.forEach((stub) => stub.mock.restore());
    }
  }
});
