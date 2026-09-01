import { NextResponse } from "next/server";
import { AuthenticatedRequest, NextMiddleware } from "../types/auth.types";
import { RateLimitService } from "../services/auth/rate-limit";

/**
 * Per-IP rate limiting for endpoints that have no authenticated API client
 * (the browser-facing /api/server/* routes). The Origin check on those routes
 * is spoofable by non-browser clients, so treat them as public and throttle
 * by IP.
 */
export async function ipRateLimitMiddleware(
  request: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { allowed, reset } = await RateLimitService.checkIpRateLimit(ip);
  if (!allowed) {
    const response = NextResponse.json(
      { error: "Too Many Requests" },
      { status: 429 },
    );
    response.headers.set("Retry-After", (reset || 60).toString());
    return response;
  }

  return await next();
}
