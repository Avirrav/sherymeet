import crypto from "crypto";
import { NextMiddleware } from "../types/auth-types";
import { ApiError } from "../utils/api-helper";
import { AuthenticatedRequest } from "../interfaces/auth-interface";

/**
 * Injects a unique trace correlation ID (X-REQUEST-ID) into the request context
 * and returns it in the final response headers.
 */
export async function requestIdMiddleware(
  request: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  const headerId = request.headers.get("x-request-id");
  if (!headerId) {
    throw new ApiError("X-REQUEST-ID is required", 400);
  }
  const requestId = `Req_${headerId}_${Date.now()}_${crypto.randomUUID().replace(/-/g, "")}`;
  // Attach to request context
  request.requestId = requestId;
  const response = await next();
  // Set header on the outgoing response
  response.headers.set("x-request-id", requestId);
  return response;
}
