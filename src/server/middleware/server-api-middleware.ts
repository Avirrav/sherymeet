import { AppMiddleware, AuthenticatedRequest, NextMiddleware } from "../types/auth.types";
import { ApiError } from "@/server/utils/api-helper";
import { config } from "@/server/utils/config";

/**
 * Server API Middleware — per-route defense-in-depth twin of src/proxy.ts.
 * Validates browser provenance for the app's own /api/server/* routes:
 *
 *  1. Sec-Fetch-Site must be same-origin when present (browsers always send
 *     it and scripts cannot alter it).
 *  2. Origin (or Referer) must match NEXT_PUBLIC_API_URL.
 *
 * These headers only filter traffic — non-browser clients can forge them.
 * Actual authentication on these routes is the signed LiveKit room token
 * each handler verifies.
 */
export const serverApiMiddleware: AppMiddleware = async (
  request: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> => {
  const origin = request.headers.get("origin") || request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");

  // In development, skip origin checks to allow egress testing from external domains
  if (config.NODE_ENV === "development") {
    return await next();
  }

  // Allow same-origin requests without further checks
  if (secFetchSite === "same-origin") {
    return await next();
  }

  // For cross-origin or non-browser requests, validate origin
  if (!origin) {
    throw new ApiError("Forbidden: Origin or Referer header is missing", 403);
  }

  try {
    const allowedOrigin = config.NEXT_PUBLIC_API_URL;
    if (!allowedOrigin) {
      throw new ApiError("Server configuration error: NEXT_PUBLIC_API_URL is not set", 500);
    }

    // Parse URLs to ensure accurate origin structure comparison (protocol + host)
    const requestOriginUrl = new URL(origin);
    const allowedOriginUrl = new URL(allowedOrigin);

    // Build list of allowed origins (main app + recording URL if different)
    const allowedOrigins = [allowedOriginUrl.origin];
    if (config.RECORDING_BASE_URL) {
      try {
        const recordingOriginUrl = new URL(config.RECORDING_BASE_URL);
        if (!allowedOrigins.includes(recordingOriginUrl.origin)) {
          allowedOrigins.push(recordingOriginUrl.origin);
        }
      } catch {
        // Invalid RECORDING_BASE_URL, ignore
      }
    }

    if (!allowedOrigins.includes(requestOriginUrl.origin)) {
      throw new ApiError("Forbidden: Origin mismatch", 403);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Forbidden: Invalid origin or referer format", 403);
  }

  return await next();
};
