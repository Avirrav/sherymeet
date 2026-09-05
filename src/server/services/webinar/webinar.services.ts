
import { MeetDao } from "@/server/dao/meet-dao";
import { ApiError } from "@/server/utils/api-helper";
import bcrypt from "bcryptjs";
import { ulid } from "ulid";

import { StatusType, MeetType } from "@/server/types/meet.types";
import { logger } from "@/server/utils/logger";

export function generateWebinarId(): string {
  return ulid();
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

export async function createInstantWebinar(passcode: string, isRecording: boolean) {
  let hashedPasscode = null;
  const salt = await bcrypt.genSalt(10);
  hashedPasscode = await bcrypt.hash(passcode, salt);
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const webinarId = generateWebinarId();
    try {
      const webinar = await MeetDao.createMeet({
        roomId: webinarId,
        roomCode: webinarId,
        status: StatusType.Creating,
        type: MeetType.Webinar,
        startedAt: null,
        endedAt: null,
        passcode: hashedPasscode,
        isRecording: isRecording,
      });
      if (webinar) {
        return webinar;
      }
      throw new ApiError("Failed to create webinar", 500);
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < MAX_ATTEMPTS) {
        logger.warn(`Webinar ID collision on attempt ${attempt}, retrying`);
        continue;
      }
      throw err;
    }
  }
}