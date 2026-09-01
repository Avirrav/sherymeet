import { AuthenticatedRequest, NextMiddleware } from "../types/auth.types";
import { AuditService } from "../services/auth/audit";

/**
 * Security Audit Middleware.
 * Captures request outcomes and records them to the audit log.
 */
export async function auditMiddleware(
  req: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  let ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  if (ip === "::1") {
    ip = "127.0.0.1";
  } else if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const method = req.method;
  const path = req.nextUrl.pathname;

  let response: Response;
  
  try {
    response = await next();
  } catch (err) {
    // Record internal execution crashes (non-blocking; logEvent never throws)
    void AuditService.logEvent({
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
  let details = "successful run";

  if (response.status >= 400) {
    if (response.status === 401) {
      eventType = "unauthorized";
      details = "Authentication failed or missing credentials";
    } else if (response.status === 403) {
      eventType = "forbidden";
      details = "Access denied: client IP, domain, or RBAC permission breach";
    } else if (response.status === 429) {
      eventType = "rate_limit_exceeded";
      details = "Request throttled: sliding window quota breach";
    } else {
      eventType = "internal_error";
      details = "Route handler returned server error";
    }

    // Try to extract the actual error message from the response payload
    try {
      const responseClone = response.clone();
      const body = await responseClone.json();
      if (body && typeof body === "object") {
        const errMsg = body.error || body.message;
        if (errMsg) {
          details = `${details}: ${errMsg}`;
        }
      }
    } catch {
      // Ignore reading failures (e.g. non-JSON responses)
    }
  }

  // Write audit details asynchronously — never block the response on the
  // audit write (logEvent catches its own failures).
  void AuditService.logEvent({
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
