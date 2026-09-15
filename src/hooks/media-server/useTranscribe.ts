import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, Participant } from "livekit-client";
import { useMeetingStore } from "@/store/useMeetingStore";
import { toast } from "sonner";
import { toAppError } from "@/types/error-types";
import { getTranscribeUrlAction } from "@/actions/transcribeAction";

// GZIP-compatible CRC32 implementation for EventStream message envelopes
const makeCRCTable = () => {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
};

const crcTable = makeCRCTable();

function crc32(buffer: Uint8Array): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

// Convert Float32 samples to Int16 PCM array
function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number = 16000,
): Int16Array {
  if (inputSampleRate === outputSampleRate) {
    const output = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      output[i] = Math.min(1, Math.max(-1, buffer[i])) * 0x7fff;
    }
    return output;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = Math.min(1, Math.max(-1, accum / (count || 1))) * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

// Package binary PCM data into AWS EventStream frame
function encodeEventStreamMessage(payload: Uint8Array): Uint8Array {
  const headersLength = 88;
  const totalLength = 12 + headersLength + payload.byteLength + 4;

  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);

  // Total byte length & headers byte length (Big Endian)
  view.setUint32(0, totalLength, false);
  view.setUint32(4, headersLength, false);

  // Preamble CRC (calculated over first 8 bytes of message)
  const preambleCRC = crc32(buffer.subarray(0, 8));
  view.setUint32(8, preambleCRC, false);

  // Headers (Required EventStream headers for AWS Transcribe AudioEvent)
  let offset = 12;
  const writeHeader = (name: string, value: string) => {
    // Header name length (1 byte)
    view.setUint8(offset, name.length);
    offset += 1;
    // Header name bytes
    for (let i = 0; i < name.length; i++) {
      view.setUint8(offset, name.charCodeAt(i));
      offset += 1;
    }
    // Header value type (7 = string)
    view.setUint8(offset, 7);
    offset += 1;
    // Header value length (2 bytes, Big Endian)
    view.setUint16(offset, value.length, false);
    offset += 2;
    // Header value bytes
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  };

  writeHeader(":content-type", "application/octet-stream");
  writeHeader(":event-type", "AudioEvent");
  writeHeader(":message-type", "event");

  // Copy raw payload bytes
  buffer.set(payload, offset);

  // Message CRC (calculated over the entire message up to the checksum field itself)
  const messageCRC = crc32(buffer.subarray(0, totalLength - 4));
  view.setUint32(totalLength - 4, messageCRC, false);

  return buffer;
}

// WebSocket.send requires an ArrayBuffer-backed view; Uint8Array's buffer type
// is ArrayBufferLike (which also covers SharedArrayBuffer), so copy into a
// fresh ArrayBuffer to satisfy the stricter DOM typing.
function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}

export function useTranscribe(room: Room | null) {
  const { captionsEnabled, meetDetails, setTranscription, transcriptions, toggleCaptions } =
    useMeetingStore();
  const transcriptionAllowed = meetDetails?.isTranscription === true;

  const [isTranscribing, setIsTranscribing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);

  const broadcastTranscription = useCallback(
    (text: string, isFinal: boolean) => {
      if (!room) return;
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "transcription",
            payload: { text, isFinal },
            senderName: room.localParticipant.name || "Anonymous",
            senderIdentity: room.localParticipant.identity,
          }),
        );
        room.localParticipant.publishData(data, { reliable: true });
      } catch (unknownErr) {
        const err = toAppError(unknownErr);
        console.error("Failed to broadcast transcription:", err.message);
      }
    },
    [room],
  );

  const stopTranscription = useCallback(() => {
    // 1. Stop audio processing nodes
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current = null;
    }
    if (streamSourceRef.current) {
      streamSourceRef.current.disconnect();
      streamSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch((unknownErr) => {
        const err = toAppError(unknownErr);
        console.error("AudioContext close error:", err.message);
      });
      audioContextRef.current = null;
    }

    // 2. Terminate WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        // Send an empty audio event to signal end of stream to AWS if open
        try {
          const emptyAudioEvent = encodeEventStreamMessage(new Uint8Array(0));
          wsRef.current.send(toArrayBufferView(emptyAudioEvent));
        } catch (unknownErr) {
          console.log("AWS", unknownErr);
        }
      }
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsTranscribing(false);
    if (room?.localParticipant) {
      setTranscription(room.localParticipant.identity, "");
    }
  }, [room, setTranscription]);

  const startTranscription = useCallback(async () => {
    if (!room || !captionsEnabled || !transcriptionAllowed) return;

    // Fetch the local participant's audio track
    const localAudioPub = Array.from(room.localParticipant.audioTrackPublications.values()).find(
      (pub) => pub.track,
    );
    const audioTrack = localAudioPub?.track;

    if (!audioTrack) {
      toast.warning("No microphone detected. Captions cannot start.");
      return;
    }

    setIsTranscribing(true);

    try {
      // 1. Retrieve signed URL using Server Action
      const result = await getTranscribeUrlAction();
      if (!result.success || !result.url) {
        throw new Error(result.error || "Failed to sign transcription URL");
      }

      // 2. Open AWS Transcribe WebSocket
      const ws = new WebSocket(result.url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        // 3. Once WebSocket opens, set up AudioContext and downsampler
        try {
          // Extract underlying browser MediaStreamTrack
          const mediaStreamTrack = audioTrack.mediaStreamTrack;
          if (!mediaStreamTrack) {
            throw new Error("Native audio track is unavailable");
          }
          const mediaStream = new MediaStream([mediaStreamTrack]);

          const AudioContextClass =
            window.AudioContext ||
            (
              window as typeof window & {
                webkitAudioContext?: typeof AudioContext;
              }
            ).webkitAudioContext;
          if (!AudioContextClass) {
            throw new Error("Web Audio API is not supported in this browser");
          }
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;

          const source = audioCtx.createMediaStreamSource(mediaStream);
          streamSourceRef.current = source;

          // ScriptProcessor buffers size 4096, 1 input channel, 1 output channel
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorNodeRef.current = processor;

          source.connect(processor);
          processor.connect(audioCtx.destination); // Destination connection required in Safari

          processor.onaudioprocess = (e) => {
            if (wsRef.current?.readyState !== WebSocket.OPEN) return;

            const inputBuffer = e.inputBuffer.getChannelData(0);
            const downsampled = downsampleBuffer(inputBuffer, audioCtx.sampleRate, 16000);

            // Frame inside EventStream and send
            const pcmBytes = new Uint8Array(downsampled.buffer);
            const message = encodeEventStreamMessage(pcmBytes);
            wsRef.current.send(toArrayBufferView(message));
          };
        } catch (unknownErr) {
          const err = toAppError(unknownErr);
          console.error("[useTranscribe] Audio processing setup failed:", err.message);
          toast.error("Failed to configure audio context downsampling");
          stopTranscription();
        }
      };

      ws.onmessage = (event) => {
        // AWS returns binary EventStream messages with JSON text payload inside
        if (!(event.data instanceof ArrayBuffer)) return;

        const arrayBuffer = event.data;
        const view = new DataView(arrayBuffer);
        const buffer = new Uint8Array(arrayBuffer);
        let offset = 0;

        while (offset < arrayBuffer.byteLength) {
          if (offset + 12 > arrayBuffer.byteLength) break;

          const totalLength = view.getUint32(offset, false);
          const headersLength = view.getUint32(offset + 4, false);

          if (offset + totalLength > arrayBuffer.byteLength) break;

          // Extract payload bytes (excluding 12 preamble bytes, headers, and 4 checksum bytes)
          const payloadBytes = buffer.subarray(
            offset + 12 + headersLength,
            offset + totalLength - 4,
          );
          const decoder = new TextDecoder();
          const jsonStr = decoder.decode(payloadBytes);

          try {
            const parsed = JSON.parse(jsonStr);
            const results = parsed.Transcript?.Results;

            if (results && results.length > 0) {
              const result = results[0];
              const transcript = result.Alternatives?.[0]?.Transcript;
              if (transcript !== undefined) {
                // Update local Zustand state
                setTranscription(room.localParticipant.identity, transcript);
                // Broadcast the transliterated text to the remote participant
                broadcastTranscription(transcript, !result.IsPartial);
              }
            }
          } catch {
            // Ignore parse errors (like exception envelopes)
          }

          offset += totalLength;
        }
      };

      ws.onerror = (e) => {
        console.error("[useTranscribe] Transcription WebSocket error:", e);
      };

      ws.onclose = () => {
        setIsTranscribing(false);
      };
    } catch (unknownErr) {
      const err = toAppError(unknownErr);
      console.error("Failed to start AWS Transcribe:", err.message);
      toast.error(err.message || "Transcription connection failed");
      stopTranscription();
    }
  }, [
    room,
    captionsEnabled,
    transcriptionAllowed,
    setTranscription,
    broadcastTranscription,
    stopTranscription,
  ]);

  // Sync transcription hook activation with captionsEnabled toggle state
  useEffect(() => {
    let active = true;
    // Defer execution to a microtask to avoid calling setState synchronously within the effect body.
    // This prevents cascading renders and aligns with React 19 standards.
    Promise.resolve().then(() => {
      if (!active) return;
      if (captionsEnabled && transcriptionAllowed) {
        startTranscription();
      } else {
        stopTranscription();
        if (captionsEnabled && !transcriptionAllowed) {
          toggleCaptions(false);
        }
      }
    });

    return () => {
      active = false;
      stopTranscription();
    };
  }, [
    captionsEnabled,
    transcriptionAllowed,
    startTranscription,
    stopTranscription,
    toggleCaptions,
  ]);

  // Synchronise remote transcription data channel packet updates
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant?: Participant) => {
      try {
        const textDecoder = new TextDecoder();
        const jsonStr = textDecoder.decode(payload);
        const data = JSON.parse(jsonStr);

        if (transcriptionAllowed && data.type === "transcription") {
          const senderIdentity = participant?.identity || data.senderIdentity;
          setTranscription(senderIdentity, data.payload.text);
        }
      } catch (unknownErr) {
        // Ignore non-transcription packets
        console.log("AWS data error", unknownErr);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, setTranscription, transcriptionAllowed]);

  return {
    isTranscribing,
    transcriptions,
  };
}
