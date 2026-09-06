import { z } from "zod";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { ConferenceRoomDao } from "@/server/dao/conferenceroom-dao";
import { MeetRegistrantDao } from "@/server/dao/meet-registrant-dao";
import { generateToken } from "@/server/services/livekit/generate-token";
import { createRegistrantSchema } from "@/server/validator/webinar.validator";
import { AuthenticatedRequest } from "@/server/types/auth.types";
import { StatusType } from "@/server/types/conferenceroom.types";
import { IParticipant, ParticipantRole } from "@/types/roles";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { rateLimitMiddleware } from "@/server/middleware/rate-limit-middleware";
import { authenticationMiddleware } from "@/server/middleware/authentication-middleware";
import { auditMiddleware } from "@/server/middleware/audit-middleware";
import { replayProtectionMiddleware } from "@/server/middleware/replay-protection-middleware";
import { validateBodyMiddleware } from "@/server/middleware/validate-body-middleware";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

function getWebinarIdFromPath(request: AuthenticatedRequest): string | null {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const index = segments.indexOf("registrants");
  return index > 0 ? segments[index - 1] : null;
}

export async function createRegistrantHandler(request: AuthenticatedRequest) {
  try {
    const webinarId = getWebinarIdFromPath(request);
    if (!webinarId) {
      throw new ApiError("Webinar ID is required", 400);
    }
    const { firstName, lastName, email } = request.validatedBody as z.infer<
      typeof createRegistrantSchema
    >;
    const webinar = await ConferenceRoomDao.getConferenceRoomByRoomId(webinarId);
    if (!webinar) {
      throw new ApiError("Webinar not found", 404);
    }
    if (webinar.status === StatusType.Ended) {
      throw new ApiError("Webinar already ended", 400);
    }
    const participant: IParticipant = {
      name: `${firstName} ${lastName}`,
      role: ParticipantRole.PARTICIPANT,
      email: email,
    };
    const token = await generateToken({
      roomId: webinarId,
      participant,
    });
    if (!token) {
      throw new ApiError("Failed to generate registrant token", 500);
    }
    const registrant = await MeetRegistrantDao.createRegistrant({
      webinarId,
      token,
      email,
      firstName,
      lastName,
    });
    return ApiResponse.success(
      {
        registrantId: registrant._id,
        webinarId,
        email: registrant.email,
        firstName: registrant.firstName,
        lastName: registrant.lastName,
        token: token,
      },
      "Registrant created successfully",
      201,
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return ApiResponse.fromError(
        new ApiError("This email is already registered for this webinar", 409),
        "Failed to register",
      );
    }
    return ApiResponse.fromError(error, "Failed to register for webinar");
  }
}

export const POST = runMiddlewares(
  [
    requestIdMiddleware,
    auditMiddleware,
    authenticationMiddleware,
    validateBodyMiddleware(createRegistrantSchema),
    rateLimitMiddleware,
    replayProtectionMiddleware,
  ],
  createRegistrantHandler,
);
