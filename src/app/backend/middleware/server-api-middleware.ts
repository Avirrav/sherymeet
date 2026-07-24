import { AppMiddleware, NextMiddleware } from "../types/auth-types";
import { AuthenticatedRequest } from "../interfaces/auth-interface";
import { ApiError } from "@/app/backend/utils/api-helper";

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
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin") {
    throw new ApiError("Forbidden: cross-origin requests are not allowed", 403);
  }

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
    if (requestOriginUrl.origin !== allowedOriginUrl.origin) {
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
