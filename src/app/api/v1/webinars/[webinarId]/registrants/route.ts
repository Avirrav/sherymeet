import { z } from "zod";
import crypto from "crypto";
import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { ConferenceRoomDao } from "@/server/dao/conferenceroom-dao";
import { MeetRegistrantDao } from "@/server/dao/meet-registrant-dao";
import { generateToken } from "@/server/services/livekit/generate-token";
import { createRegistrantSchema } from "@/server/validator/webinar.validator";
import { AuthenticatedRequest } from "@/server/types/auth.types";
import { StatusType } from "@/server/types/conferenceroom.types";
import { IParticipant, ParticipantRole } from "@/types/roles";
import { config } from "@/server/utils/config";
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

/**
 * Pulls `webinarId` out of the URL path directly instead of a route-context
 * `{ params }` argument: runMiddlewares() (run-middlewares.ts) only forwards
 * the request itself to middlewares/handler, not Next's second route-context
 * parameter, so `[webinarId]` never reaches the handler through the normal
 * dynamic-segment mechanism. Path shape: /api/v1/webinars/{webinarId}/registrants.
 */
function getWebinarIdFromPath(request: AuthenticatedRequest): string | null {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const index = segments.indexOf("registrants");
  return index > 0 ? segments[index - 1] : null;
}

// POST /api/v1/webinars/:webinarId/registrants — registers an attendee for a
// webinar and mints their personal join link.
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

    // Registrants join as regular participants; hosts get their token from
    // the start-webinar flow, not registration.
    const participant: IParticipant = {
      name: `${firstName} ${lastName}`,
      role: ParticipantRole.PARTICIPANT,
    };
    const token = await generateToken({
      roomId: webinarId,
      participant,
      metadata: JSON.stringify({ registrantId: crypto.randomUUID(), email }),
    });
    if (!token) {
      throw new ApiError("Failed to generate registrant token", 500);
    }

    // Token travels in the hash fragment so it never reaches server logs,
    // proxies, or Referer headers — same convention as the host/participant
    // join links (see create-start-url, join-as-user).
    const joinUrl = `${config.NEXT_PUBLIC_API_URL}/meet/${webinarId}#token=${encodeURIComponent(token)}`;

    const registrant = await MeetRegistrantDao.createRegistrant({
      webinarId,
      token,
      email,
      firstName,
      lastName,
      joinUrl,
    });

    return ApiResponse.success(
      {
        registrantId: registrant._id,
        webinarId,
        email: registrant.email,
        firstName: registrant.firstName,
        lastName: registrant.lastName,
        joinUrl: registrant.joinUrl,
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
