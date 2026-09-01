import crypto from "crypto";
import { MeetDao } from "../../dao/meet-dao";
import { ApiError } from "../../utils/api-helper";
import bcrypt from "bcryptjs";
import { logger } from "../../utils/logger";

interface CreateInstantMeetOptions {
  passcode?: string | null;
  type?: "webinar" | "meet";
  isRecording?: boolean;
}

/**
 * Generates a clean room code in the standard format like abc-defg-hij.
 * Uses crypto.randomInt because the room code doubles as a capability
 * (knowing it is a precondition to joining), so it must be unguessable.
 */
export function generateRoomCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[crypto.randomInt(chars.length)]).join("");
  return `${part(3)}-${part(4)}-${part(3)}`;
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

/**
 * Initializes a meeting by generating a room code locally and saving the record
 * to MongoDB, without generating tokens or calling external LiveKit room creation APIs.
 */
export async function createInstantMeet({
  passcode,
  type,
  isRecording,
}: CreateInstantMeetOptions) {
  // 1. Hash passcode if provided using production-grade bcrypt
  let hashedPasscode = null;
  if (passcode) {
    const salt = await bcrypt.genSalt(10);
    hashedPasscode = await bcrypt.hash(passcode, salt);
  }

  // 2. Save meeting details, retrying on the (rare) room-code collision that
  // surfaces as a duplicate-key error from the unique index.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const roomName = generateRoomCode();
    try {
      const meet = await MeetDao.createMeet({
        roomId: roomName,
        roomCode: roomName,
        status: "scheduled" as const,
        type,
        startedAt: null,
        endedAt: null,
        passcode: hashedPasscode,
        isRecording: !!isRecording,
      });
      if (meet) {
        return meet;
      }
      throw new ApiError("Failed to create meeting", 500);
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < MAX_ATTEMPTS) {
        logger.warn(`Room code collision on attempt ${attempt}, retrying`);
        continue;
      }
      throw err;
    }
  }
  throw new ApiError("Failed to create meeting", 500);
}
