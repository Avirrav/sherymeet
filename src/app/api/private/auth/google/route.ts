import crypto from "crypto";
import { NextResponse } from "next/server";
import { GoogleOAuthService, OAUTH_STATE_COOKIE_NAME } from "@/server/services/auth/google-oauth";
import { isProduction } from "@/server/utils/config";

/**
 * Begins the "Login with Google" flow.
 * GET /api/private/auth/google
 */
export async function GET(): Promise<Response> {
  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = GoogleOAuthService.buildAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    maxAge: 600, // 10 minutes to complete the OAuth round-trip
    path: "/",
  });
  return response;
}
