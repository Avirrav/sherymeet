import { MeetDao } from "../../dao/meet-dao";
import { ApiError } from "../../utils/api-helper";
import { IUser } from "../../interfaces/user-interface";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

interface CreateInstantMeetOptions {
  host: IUser;
  passcode?: string | null;
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
  host,
  passcode,
}: CreateInstantMeetOptions) {
  if (!host) {
    throw new ApiError("Host details are required", 400);
  }
  if (!host.userName || !host.role) {
    throw new ApiError("Host userName and role are required", 400);
  }

  // 1. Generate room code locally
  const roomName = generateRoomCode();

  // 2. Resolve a valid 24-character hexadecimal ObjectId for MongoDB insert
  let rawUserId = host._id ? host._id.toString() : "";
  if (!rawUserId || !/^[0-9a-fA-F]{24}$/.test(rawUserId)) {
    rawUserId = new mongoose.Types.ObjectId().toHexString();
  }

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
    startedAt: null,
    endedAt: null,
    host: {
      userId: rawUserId,
      username: host.userName,
      role: host.role,
    },
    passcode: hashedPasscode,
  };
  const meet = await MeetDao.createMeet(meetData);
  console.log("Saved Meet", meet)
  if (meet) {
    return meet;
  } else {
    throw new ApiError("Failed to create meeting", 500);
  }
}
