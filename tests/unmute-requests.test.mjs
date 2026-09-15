import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  requestParticipantUnmute,
  registerUnmuteRequests,
} from "../src/components/meet/unmute-requests.ts";
import ParticipantsPanelModule from "../src/components/meet/ParticipantsPanel.tsx";
import ParticipantModerationControlsModule from "../src/components/meet/ParticipantModerationControls.tsx";

// tsx loads these TSX files through the repository's CommonJS boundary.
const ParticipantsPanel = ParticipantsPanelModule.default ?? ParticipantsPanelModule;
const ParticipantModerationControls =
  ParticipantModerationControlsModule.default ?? ParticipantModerationControlsModule;

function participant(role, identity = role, canPublish = false) {
  return {
    identity,
    name: identity,
    metadata: JSON.stringify({ participant: { role } }),
    permissions: { canPublish },
    isMicrophoneEnabled: false,
    isCameraEnabled: false,
    getTrackPublication: () => undefined,
  };
}

function recipientRoom(canPublish) {
  let handler;
  let unregistered = false;
  const localParticipant = {
    ...participant("participant", "viewer", canPublish),
    registerRpcMethod: (_method, callback) => {
      handler = callback;
    },
    unregisterRpcMethod: () => {
      unregistered = true;
    },
    setMicrophoneEnabled: () => {
      throw new Error("Request must never activate microphone");
    },
  };
  return {
    room: {
      localParticipant,
      remoteParticipants: new Map([
        ["host", participant("host")],
        ["viewer", participant("participant", "viewer")],
      ]),
    },
    invoke: (callerIdentity) => handler({ callerIdentity }),
    unregistered: () => unregistered,
  };
}

test("unmute RPC tolerates a normal delayed acknowledgement rather than timing out at 5 ms", async () => {
  const result = await requestParticipantUnmute(
    {
      localParticipant: {
        performRpc: ({ destinationIdentity, responseTimeout }) =>
          new Promise((resolve, reject) => {
            assert.equal(destinationIdentity, "viewer");
            const deadline = setTimeout(
              () => reject(new Error("Response timeout")),
              responseTimeout,
            );
            setTimeout(() => {
              clearTimeout(deadline);
              resolve("requested");
            }, 30);
          }),
      },
    },
    "viewer",
  );
  assert.equal(result, "requested");
});

test("audience receives admin requests without publishing permission or microphone activation", async () => {
  const fixture = recipientRoom(false);
  let notice;
  const cleanup = registerUnmuteRequests(fixture.room, (caller, canPublish) => {
    notice = { caller, canPublish };
  });
  assert.equal(await fixture.invoke("host"), "permission_required");
  assert.equal(notice.caller.identity, "host");
  assert.equal(notice.canPublish, false);
  assert.equal(fixture.room.localParticipant.isMicrophoneEnabled, false);
  assert.equal(fixture.room.localParticipant.permissions.canPublish, false);
  cleanup();
  assert.equal(fixture.unregistered(), true);
});

test("delivery acknowledgement does not wait for consent, and repeated requests are deduplicated", async () => {
  const fixture = recipientRoom(true);
  let notices = 0;
  registerUnmuteRequests(fixture.room, () => {
    notices++;
    return new Promise(() => {});
  });
  assert.equal(await fixture.invoke("host"), "requested");
  assert.equal(await fixture.invoke("host"), "already_requested");
  assert.equal(notices, 1);
  assert.equal(fixture.room.localParticipant.isMicrophoneEnabled, false);
});

test("unknown and non-admin senders cannot prompt a participant", async () => {
  const fixture = recipientRoom(true);
  let notices = 0;
  registerUnmuteRequests(fixture.room, () => notices++);
  await assert.rejects(fixture.invoke("missing"), /Admin request required/);
  await assert.rejects(fixture.invoke("viewer"), /Admin request required/);
  assert.equal(notices, 0);
});

test("participant panel and count render only for host and co-host", () => {
  for (const role of ["participant", "panelist", "host", "co_host"]) {
    const html = renderToStaticMarkup(
      React.createElement(ParticipantsPanel, {
        room: { localParticipant: participant(role), remoteParticipants: new Map() },
        onClose() {},
      }),
    );
    if (role === "host" || role === "co_host") assert.match(html, /Participants \(1\)/);
    else assert.equal(html, "");
  }
});

test("admin can ask every other role to unmute, including audience with canPublish false", () => {
  const room = { localParticipant: participant("host", "local-host", true) };
  for (const role of ["participant", "panelist", "host", "co_host"]) {
    const html = renderToStaticMarkup(
      React.createElement(ParticipantModerationControls, {
        room,
        participant: participant(role, `remote-${role}`, false),
      }),
    );
    assert.match(html, /Ask to unmute/);
    assert.doesNotMatch(html, /disabled="/);
  }
});

test("microphone-only audience can accept unmute while camera, screen share, and panel remain unavailable", async () => {
  const { Track } = await import("livekit-client");
  const {
    canParticipantUseMicrophone,
    canParticipantUseCamera,
    canParticipantShareScreen,
    isPanelParticipant,
  } = await import("../src/components/meet/participant-permissions.ts");
  const fixture = recipientRoom(true);
  fixture.room.localParticipant.permissions.canPublishSources = [
    Track.sourceToProto(Track.Source.Microphone),
  ];
  const local = fixture.room.localParticipant;
  assert.equal(canParticipantUseMicrophone(local), true);
  assert.equal(canParticipantUseCamera(local), false);
  assert.equal(canParticipantShareScreen(local), false);
  assert.equal(isPanelParticipant(local), false);
  let allowed;
  registerUnmuteRequests(fixture.room, (_caller, canUseMicrophone) => {
    allowed = canUseMicrophone;
  });
  assert.equal(await fixture.invoke("host"), "requested");
  assert.equal(allowed, true);
  assert.equal(local.isMicrophoneEnabled, false);
});
