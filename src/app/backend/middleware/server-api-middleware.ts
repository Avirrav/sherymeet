import { AppMiddleware, NextMiddleware } from "../types/auth-types";
import { AuthenticatedRequest } from "../interfaces/auth-interface";
import { ApiError } from "@/app/backend/utils/api-helper";

/**
 * Server API Middleware.
 * Validates that the request origin (or referer) matches the configured NEXT_PUBLIC_API_URL.
 */
export const serverApiMiddleware: AppMiddleware = async (
  request: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> => {
  const origin = request.headers.get("origin") || request.headers.get("referer");

  if (!origin) {
    throw new ApiError("Forbidden: Origin or Referer header is missing", 403);
  }

  try {
    const allowedOrigin = process.env.NEXT_PUBLIC_API_URL;
    if (!allowedOrigin) {
      throw new ApiError("Server configuration error: NEXT_PUBLIC_API_URL is not set", 500);
    }

    // Parse URLs to ensure accurate origin structure comparison (protocol + host)
    const requestOriginUrl = new URL(origin);
    const allowedOriginUrl = new URL(allowedOrigin);
    console.log({ requestOriginUrl: requestOriginUrl.origin, allowedOriginUrl: allowedOriginUrl.origin })
    if (requestOriginUrl.origin !== allowedOriginUrl.origin) {
      throw new ApiError(`Forbidden: Origin mismatch. Got: ${requestOriginUrl.origin}`, 403);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Forbidden: Invalid origin or referer format", 403);
  }

  return await next();
};
