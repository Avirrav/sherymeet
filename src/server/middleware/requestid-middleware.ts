import crypto from "crypto";
import { AuthenticatedRequest, NextMiddleware } from "../types/auth.types";

/**
 * Injects a unique trace correlation ID (X-REQUEST-ID) into the request context
 * and returns it in the final response headers. Uses the caller-supplied
 * x-request-id when present (API clients); otherwise generates one, so the
 * middleware also works for browser-originated requests.
 */
export async function requestIdMiddleware(
  request: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  const headerId = request.headers.get("x-request-id") || crypto.randomUUID();
  const requestId = `Req_${headerId}_${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}`;
  // Attach to request context
  request.requestId = requestId;
  const response = await next();
  // Set header on the outgoing response
  response.headers.set("x-request-id", requestId);
  return response;
}
