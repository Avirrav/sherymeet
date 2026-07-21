import { NextResponse } from "next/server";
import { runMiddlewares } from "@/app/backend/middleware/run-middlewares";
import { auditMiddleware } from "@/app/backend/middleware/audit-middleware";
import { userAuthenticationMiddleware } from "@/app/backend/middleware/user-authentication-middleware";
import { AuthenticatedRequest } from "@/app/backend/interfaces/auth-interface";

/**
 * Returns the currently logged-in platform user (based on the session cookie).
 * GET /api/private/auth/me
 */
export async function meHandler(req: AuthenticatedRequest): Promise<Response> {
  return NextResponse.json({ user: req.user });
}

export const GET = runMiddlewares([auditMiddleware, userAuthenticationMiddleware], meHandler);
