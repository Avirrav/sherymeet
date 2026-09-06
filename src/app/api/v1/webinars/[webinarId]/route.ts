import { ApiError, ApiResponse } from "@/server/utils/api-helper";
import { getWebinarDetails } from "@/server/services/webinar/webinar.services";
import { AuthenticatedRequest } from "@/server/types/auth.types";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { requestIdMiddleware } from "@/server/middleware/requestid-middleware";
import { rateLimitMiddleware } from "@/server/middleware/rate-limit-middleware";
import { authenticationMiddleware } from "@/server/middleware/authentication-middleware";
import { auditMiddleware } from "@/server/middleware/audit-middleware";

function getWebinarIdFromPath(request: AuthenticatedRequest): string | null {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] || null;
}

export async function getWebinarDetailsHandler(request: AuthenticatedRequest) {
  try {
    const webinarId = getWebinarIdFromPath(request);
    if (!webinarId) {
      throw new ApiError("Webinar ID is required", 400);
    }
    const webinar = await getWebinarDetails(webinarId);
    return ApiResponse.success(webinar);
  } catch (error) {
    return ApiResponse.fromError(error, "Failed to fetch webinar details");
  }
}

export const GET = runMiddlewares(
  [requestIdMiddleware, auditMiddleware, authenticationMiddleware, rateLimitMiddleware],
  getWebinarDetailsHandler,
);
