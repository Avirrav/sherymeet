import { MeetDao } from "../../dao/meet-dao";
import { ApiError } from "../../utils/api-helper";
import { IUser } from "../../interfaces/user-interface";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

interface CreateInstantMeetOptions {
  passcode?: string | null;
  type?: "webinar" | "meet";
  isRecording?: boolean;
}

/**
 * Generates a clean room code in the standard format like abc-defg-hij.
 */
function generateRoomCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const part = (len: number) =>
    Array.from(
      { length: len },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  return `${part(3)}-${part(4)}-${part(3)}`;
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

  // 1. Generate room code locally
  const roomName = generateRoomCode();

  // 3. Hash passcode if provided using production-grade bcrypt
  let hashedPasscode = null;
  if (passcode) {
    const salt = await bcrypt.genSalt(10);
    hashedPasscode = await bcrypt.hash(passcode, salt);
  }

  // 4. Save meeting details to MongoDB via MeetDao
  const meetData = {
    roomId: roomName,
    roomCode: roomName,
    status: "scheduled" as const,
    type,
    startedAt: null,
    endedAt: null,
    passcode: hashedPasscode,
    isRecording: !!isRecording,
  };
  const meet = await MeetDao.createMeet(meetData);
  console.log("Saved Meet", meet)
  if (meet) {
    return meet;
  } else {
    throw new ApiError("Failed to create meeting", 500);
  }
}
