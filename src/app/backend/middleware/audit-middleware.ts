import { NextMiddleware } from "../types/auth-types";
import { AuthenticatedRequest } from "../interfaces/auth-interface";
import { AuditService } from "../services/audit-service";

/**
 * Security Audit Middleware.
 * Captures request outcomes and records them to the audit log.
 */
export async function auditMiddleware(
  req: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const method = req.method;
  const path = req.nextUrl.pathname;

  let response: Response;

  try {
    response = await next();
  } catch (err) {
    // Record internal execution crashes
    await AuditService.logEvent({
      requestId: req.requestId || "unknown",
      apiKey: req.client?.apiKey,
      userId: req.user?._id?.toString(),
      ip,
      origin,
      method,
      path,
      eventType: "internal_error",
      status: 500,
      details: (err as Error).message,
    });
    throw err;
  }

  // Determine security event classification
  let eventType = "authentication_success";
  let details = "";

  if (response.status === 401) {
    eventType = "unauthorized";
    details = "Authentication failed or missing credentials";
  } else if (response.status === 403) {
    eventType = "forbidden";
    details = "Access denied: client IP, domain, or RBAC permission breach";
  } else if (response.status === 429) {
    eventType = "rate_limit_exceeded";
    details = "Request throttled: sliding window quota breach";
  } else if (response.status >= 500) {
    eventType = "internal_error";
    details = "Route handler returned server error";
  }

  // Write audit details asynchronously
  await AuditService.logEvent({
    requestId: req.requestId || "unknown",
    apiKey: req.client?.apiKey,
    userId: req.user?._id?.toString(),
    ip,
    origin,
    method,
    path,
    eventType,
    status: response.status,
    details,
  });

  return response;
}
