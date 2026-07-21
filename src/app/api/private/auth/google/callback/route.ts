import { NextRequest, NextResponse } from "next/server";
import { GoogleOAuthService, OAUTH_STATE_COOKIE_NAME } from "@/app/backend/services/google-oauth-service";
import { UserService } from "@/app/backend/services/user-service";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/app/backend/services/session-service";
import { logger } from "@/app/backend/utils/logger";

/**
 * Completes the "Login with Google" flow: exchanges the auth code, upserts the
 * platform user, and issues a signed session cookie before redirecting to the dashboard.
 * GET /api/private/auth/google/callback
 */
export async function GET(req: NextRequest): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  const failureRedirect = (reason: string) => {
    const response = NextResponse.redirect(`${baseUrl}/?authError=${encodeURIComponent(reason)}`);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  };

  if (oauthError) {
    return failureRedirect("google_denied");
  }

  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return failureRedirect("invalid_state");
  }

  try {
    const accessToken = await GoogleOAuthService.exchangeCodeForAccessToken(code);
    const profile = await GoogleOAuthService.fetchProfile(accessToken);

    if (profile.email_verified === false) {
      return failureRedirect("email_not_verified");
    }

    const user = await UserService.findOrCreateFromGoogleProfile(profile);

    const sessionToken = createSessionToken({
      userId: user._id.toString(),
      email: user.email,
      userName: user.userName,
      role: user.role,
    });

    const response = NextResponse.redirect(`${baseUrl}/dashboard`);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
    return response;
  } catch (err) {
    logger.error("Google OAuth callback failed", err);
    return failureRedirect("google_auth_failed");
  }
}
