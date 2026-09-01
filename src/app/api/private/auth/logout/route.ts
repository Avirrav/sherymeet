import { NextResponse } from "next/server";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { auditMiddleware } from "@/server/middleware/audit-middleware";
import { SESSION_COOKIE_NAME } from "@/server/services/auth/session";

/**
 * Logs the platform user out by clearing the session cookie.
 * POST /api/private/auth/logout
 */
export async function logoutHandler(): Promise<Response> {
  const response = NextResponse.json({ message: "Logged out successfully" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export const POST = runMiddlewares([auditMiddleware], logoutHandler);
