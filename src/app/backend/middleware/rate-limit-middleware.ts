import { NextResponse } from "next/server";
import { NextMiddleware } from "../types/auth-types";
import { RateLimitService } from "../services/rate-limit-service";
import { AuthenticatedRequest } from "../interfaces/auth-interface";

/**
 * Rate Limiting Middleware.
 * Enforces client quotas across sliding windows (burst, minute, daily).
 */
export async function rateLimitMiddleware(
  request: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  const client = request.client;
  if (!client) {
    return NextResponse.json(
      { error: "Unauthorized: Missing API Client" },
      { status: 401 },
    );
  }
  // const apiKey = request.headers.get("x-api-key") || "";
  const { allowed, limitType, remaining, reset } =
    await RateLimitService.checkRateLimits(client.apiKey, {
      rateLimit: client.rateLimit,
      burstLimit: client.burstLimit,
      dailyLimit: client.dailyLimit,
    });
  if (!allowed) {
    const response = NextResponse.json(
      { error: `Too Many Requests: ${limitType} limit exceeded` },
      { status: 429 },
    );
    // Set standard rate limit headers
    // response.headers.set("Retry-After", (reset || 60).toString());
    response.headers.set("X-RateLimit-Limit", client.rateLimit.toString());
    response.headers.set("X-RateLimit-Limit", (100).toString());
    response.headers.set("X-RateLimit-Remaining", "0");
    response.headers.set("X-RateLimit-Reset", (reset || 60).toString());
    return response;
  }
  const response = await next();
  // Inject remaining quotas into headers
  if (remaining !== undefined) {
    response.headers.set("X-RateLimit-Limit", client.rateLimit.toString());
    // response.headers.set("X-RateLimit-Limit", (100).toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", (reset || 60).toString());
  }

  return response;
}
