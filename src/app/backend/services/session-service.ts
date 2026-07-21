import { cookies } from "next/headers";
import { hmacSha256, timingSafeEqual } from "../utils/crypto-helper";
import { UserService } from "./user-service";
import { IUser, UserRole } from "../interfaces/user-interface";

export const SESSION_COOKIE_NAME = "sherymeet_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

const SESSION_SECRET_FALLBACK = "sherymeet_default_dev_session_secret_change_me!";

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || SESSION_SECRET_FALLBACK;
}

export interface SessionPayload {
  userId: string;
  email: string;
  userName: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Creates a signed, stateless session token: base64url(payload).hmacSignature
 */
export function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = hmacSha256(getSessionSecret(), encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies a session token's signature and expiry, returning the decoded payload if valid.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  const expectedSignature = hmacSha256(getSessionSecret(), encodedPayload);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Reads and verifies the session cookie in a Server Component / Server Action context,
 * re-checking the user against the database (to catch blocked/deleted accounts) and
 * returning the current authenticated user, or null if there is no valid session.
 */
export async function getSessionUser(): Promise<IUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = await UserService.getUserById(payload.userId);
  if (!user || user.status !== "active") return null;

  return {
    _id: user._id.toString(),
    userName: user.userName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}
