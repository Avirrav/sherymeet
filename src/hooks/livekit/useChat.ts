import { useCallback, useEffect } from "react";
import { Room, RoomEvent, Participant } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { toAppError } from "@/app/backend/types/error";

export function useChat(room: Room | null) {
  const {
    addChatMessage,
    addRaisedHand,
    removeRaisedHand,
    chatMessages,
    isHandRaised,
    toggleHandRaise,
  } = useMeetingStore();

  const sendData = useCallback(
    async (type: string, payload: unknown) => {
      if (!room) return;
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
        await room.localParticipant.publishData(data, { reliable: true });
      } catch (unknownErr) {
        const err = toAppError(unknownErr);
        console.error("Failed to send data:", err.message);
      }
    },
    [room],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!room || !text.trim()) return;

      // 1. Send via data channel
      await sendData("chat", { text });

      // 2. Add locally in store
      addChatMessage({
        senderName: room.localParticipant.name || "You",
        senderIdentity: room.localParticipant.identity,
        text,
      });
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

  useEffect(() => {
    if (!room) return;

    const decoder = new TextDecoder();

    const handleDataReceived = (payload: Uint8Array, participant?: Participant) => {
      try {
        const dataStr = decoder.decode(payload);
        const data = JSON.parse(dataStr);

        const senderIdentity = participant?.identity || data.senderIdentity;
        const senderName = participant?.name || data.senderName || "Anonymous";

        if (data.type === "chat") {
          addChatMessage({
            senderName,
            senderIdentity,
            text: data.payload.text,
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
    };
  }, [room, addChatMessage, addRaisedHand, removeRaisedHand]);

  return {
    sendMessage,
    messages: chatMessages,
    isHandRaised,
    raiseHand,
  };
}
