import { NextResponse } from "next/server";
import { AuthenticatedRequest, NextMiddleware } from "../types/auth.types";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../services/auth/session";
import { UserService } from "../services/auth/user";
import { logger } from "../utils/logger";

/**
 * Platform User Authentication Middleware.
 * Verifies the dashboard's signed session cookie to confirm a Sherymeet platform
 * user (authenticated via "Login with Google") is logged in. This is separate from
 * `authenticationMiddleware`, which only validates HMAC-signed API client requests.
 */
export async function userAuthenticationMiddleware(
  request: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized: You must be logged in to perform this action" },
      { status: 401 },
    );
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Unauthorized: Session is invalid or expired" },
      { status: 401 },
    );
  }
  try {
    const user = await UserService.getUserById(payload.userId);
    if (!user || user.status !== "active") {
      return NextResponse.json(
        { error: "Unauthorized: User account is not active" },
        { status: 401 },
      );
    }
    request.user = {
      _id: user._id.toString(),
      userName: user.userName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  } catch (err) {
    logger.error("Failed to verify platform user session", err, {
      requestId: request.requestId,
    });
    return NextResponse.json(
      { error: "Unauthorized: Failed to verify session" },
      { status: 401 },
    );
  }

  return await next();
}
