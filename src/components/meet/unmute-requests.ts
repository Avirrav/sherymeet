import type { Room, RemoteParticipant } from "livekit-client";
import { canParticipantUseMicrophone, isCoHostOrAbove } from "./participant-permissions";

const REQUEST_UNMUTE = "sherymeet.request-unmute";

export function requestParticipantUnmute(room: Room, identity: string): Promise<string> {
  return room.localParticipant.performRpc({
    destinationIdentity: identity,
    method: REQUEST_UNMUTE,
    payload: "",
    // LiveKit's JavaScript SDK uses milliseconds, not seconds.
    responseTimeout: 10_000,
  });
}

export function registerUnmuteRequests(
  room: Room,
  notify: (caller: RemoteParticipant, canUseMicrophone: boolean) => void,
): () => void {
  let lastRequest = 0;
  room.localParticipant.registerRpcMethod(REQUEST_UNMUTE, async ({ callerIdentity }) => {
    const caller = room.remoteParticipants.get(callerIdentity);
    if (!caller || !isCoHostOrAbove(caller)) throw new Error("Admin request required");
    if (room.localParticipant.isMicrophoneEnabled) return "already_unmuted";
    if (Date.now() - lastRequest < 10_000) return "already_requested";
    lastRequest = Date.now();
    const canUseMicrophone = canParticipantUseMicrophone(room.localParticipant);
    notify(caller, canUseMicrophone);
    // Acknowledge delivery immediately, including for audience members.
    // The participant's later choice to enable audio is independent of RPC.
    return canUseMicrophone ? "requested" : "permission_required";
  });
  return () => room.localParticipant.unregisterRpcMethod(REQUEST_UNMUTE);
}
