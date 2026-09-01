import { NextResponse } from "next/server";
import { runMiddlewares } from "@/server/middleware/run-middlewares";
import { auditMiddleware } from "@/server/middleware/audit-middleware";
import { userAuthenticationMiddleware } from "@/server/middleware/user-authentication-middleware";
import { AuthenticatedRequest } from "@/server/types/auth.types";

/**
 * Returns the currently logged-in platform user (based on the session cookie).
 * GET /api/private/auth/me
 */
export async function meHandler(req: AuthenticatedRequest): Promise<Response> {
  return NextResponse.json({ user: req.user });
}

export const GET = runMiddlewares([auditMiddleware, userAuthenticationMiddleware], meHandler);
