import { useCallback, useEffect, useRef } from "react";
import { Room, RoomEvent, Participant, ConnectionState } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import type { ChatRecipient } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { toAppError } from "@/types/error-types";

import {
  isReactionEmoji,
  type MeetingReaction,
  type ReactionEmoji,
} from "@/components/meet/reactions";

import { isHostRole } from "@/components/meet/participant-permissions";
import {
  getChatSlowModeSeconds,
  isChatEnabled,
  observeChatSetting,
} from "@/components/meet/chat-permissions";

export function useChat(
  room: Room | null,
  onReaction?: (reaction: MeetingReaction) => void,
  receiveEvents = true,
) {
  const lastReactionAt = useRef(0);
  const {
    addChatMessage,
    addRaisedHand,
    removeRaisedHand,
    chatMessages,
    isHandRaised,
    toggleHandRaise,
  } = useMeetingStore();

  const sendData = useCallback(
    async (type: string, payload: unknown, destinationIdentities?: string[]) => {
      if (!room) return false;
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type,
            payload,
            senderName: room.localParticipant.name || "Anonymous",
            senderIdentity: room.localParticipant.identity,
          }),
        );
        await room.localParticipant.publishData(data, {
          reliable: true,
          ...(destinationIdentities?.length ? { destinationIdentities } : {}),
        });
        return true;
      } catch (unknownErr) {
        const err = toAppError(unknownErr);
        console.error("Failed to send data:", err.message);
        return false;
      }
    },
    [room],
  );

  const sendMessage = useCallback(
    async (text: string, recipient: ChatRecipient = "everyone") => {
      if (!room || room.state !== ConnectionState.Connected || !text.trim()) return false;
      if (!isChatEnabled(room.metadata) && !isHostRole(room.localParticipant)) return false;
      const isHost = isHostRole(room.localParticipant);
      const slowModeSeconds = getChatSlowModeSeconds(room.metadata);
      const lastSentAt = useMeetingStore.getState().lastChatSentAt;
      const remainingMs = lastSentAt + slowModeSeconds * 1000 - Date.now();
      if (!isHost && slowModeSeconds > 0 && remainingMs > 0) {
        toast.info(`Slow mode: wait ${Math.ceil(remainingMs / 1000)} seconds`);
        return false;
      }

      const destinationIdentities =
        recipient === "host"
          ? Array.from(room.remoteParticipants.values())
              .filter(isHostRole)
              .map((participant) => participant.identity)
          : undefined;
      if (recipient === "host" && !destinationIdentities?.length) {
        toast.warning("No host is currently available");
        return false;
      }

      // 1. Send via data channel
      if (!(await sendData("chat", { text, recipient }, destinationIdentities))) return false;

      // 2. Add locally in store
      addChatMessage({
        senderName: room.localParticipant.name || "You",
        senderIdentity: room.localParticipant.identity,
        text,
        recipient,
      });
      if (!isHost && slowModeSeconds > 0) useMeetingStore.getState().setLastChatSentAt(Date.now());
      return true;
    },
    [room, sendData, addChatMessage],
  );

  const raiseHand = useCallback(
    async (raised: boolean) => {
      toggleHandRaise(raised);
      await sendData("hand-raise", { raised });

      if (raised) {
        if (room) addRaisedHand(room.localParticipant.identity);
        toast.info("You raised your hand");
      } else {
        if (room) removeRaisedHand(room.localParticipant.identity);
      }
    },
    [room, sendData, toggleHandRaise, addRaisedHand, removeRaisedHand],
  );

  const sendReaction = useCallback(
    async (emoji: ReactionEmoji) => {
      if (
        !room ||
        room.state !== ConnectionState.Connected ||
        room.localParticipant.permissions?.canPublishData === false ||
        !isReactionEmoji(emoji) ||
        Date.now() - lastReactionAt.current < 1000
      )
        return;
      lastReactionAt.current = Date.now();
      if (await sendData("reaction", { emoji })) {
        onReaction?.({
          emoji,
          senderIdentity: room.localParticipant.identity,
          senderName: room.localParticipant.name || "You",
        });
      } else {
        toast.error("Could not send reaction. Please try again.");
      }
    },
    [room, sendData, onReaction],
  );

  useEffect(() => {
    if (!room || !receiveEvents) return;

    const stopObservingChat = observeChatSetting(
      room,
      useMeetingStore.getState().setChatEnabled,
      useMeetingStore.getState().setChatSlowModeSeconds,
    );
    const decoder = new TextDecoder();

    const handleDataReceived = (payload: Uint8Array, participant?: Participant) => {
      try {
        const dataStr = decoder.decode(payload);
        const data = JSON.parse(dataStr);

        const senderIdentity = participant?.identity || data.senderIdentity;
        const senderName = participant?.name || data.senderName || "Anonymous";

        if (data.type === "reaction") {
          // Trust LiveKit's sender, not identity/name supplied in the packet.
          if (participant && isReactionEmoji(data.payload?.emoji)) {
            onReaction?.({
              emoji: data.payload.emoji,
              senderIdentity: participant.identity,
              senderName: participant.name || "Anonymous",
            });
          }
        } else if (data.type === "chat") {
          if (!participant || typeof data.payload?.text !== "string") return;
          if (!isChatEnabled(room.metadata) && !isHostRole(participant)) return;
          const recipient: ChatRecipient = data.payload?.recipient === "host" ? "host" : "everyone";
          if (recipient === "host" && !isHostRole(room.localParticipant)) return;
          addChatMessage({
            senderName,
            senderIdentity,
            text: data.payload.text,
            recipient,
          });
        } else if (data.type === "hand-raise") {
          if (data.payload.raised) {
            addRaisedHand(senderIdentity);
            toast.info(`${senderName} raised their hand ✋`);
          } else {
            removeRaisedHand(senderIdentity);
          }
        }
      } catch (unknownErr) {
        const err = toAppError(unknownErr);
        console.error("Error parsing data channel payload:", err.message);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      stopObservingChat();
    };
  }, [room, addChatMessage, addRaisedHand, removeRaisedHand, onReaction, receiveEvents]);

  return {
    sendMessage,
    sendReaction,
    messages: chatMessages,
    isHandRaised,
    raiseHand,
  };
}
