import { GoogleProfile } from "./user";
import { config } from "../../utils/config";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

// Short-lived cookie used to hold the CSRF `state` value between the login redirect and callback.
export const OAUTH_STATE_COOKIE_NAME = "sherymeet_oauth_state";

function getRedirectUri(): string {
  const baseUrl = config.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  return `${baseUrl}/api/private/auth/google/callback`;
}

export class GoogleOAuthService {
  /**
   * Builds the Google OAuth 2.0 consent screen URL for the "Login with Google" flow.
   */
  static buildAuthUrl(state: string): string {
    const clientId = config.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("Server configuration error: GOOGLE_CLIENT_ID is not set");
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
      state,
    });

    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for an access token.
   */
  static async exchangeCodeForAccessToken(code: string): Promise<string> {
    const clientId = config.GOOGLE_CLIENT_ID;
    const clientSecret = config.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "Server configuration error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set",
      );
    }

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getRedirectUri(),
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error(`Google token exchange failed: ${await response.text()}`);
    }

    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new Error("Google token exchange response did not include an access_token");
    }
    return data.access_token;
  }

  /**
   * Fetches the authenticated user's Google profile using an access token.
   */
  static async fetchProfile(accessToken: string): Promise<GoogleProfile> {
    const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google user profile: ${await response.text()}`);
    }

    return (await response.json()) as GoogleProfile;
  }
}
