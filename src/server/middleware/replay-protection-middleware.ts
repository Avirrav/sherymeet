import { NextResponse } from "next/server";
import { AuthenticatedRequest, NextMiddleware } from "../types/auth.types";
import { NonceService } from "../services/auth/nonce";

/**
 * Replay Protection Middleware.
 * Enforces one-time nonce checks per API key using our cache store.
 */
export async function replayProtectionMiddleware(
  req: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  const client = req.client;
  const nonce = req.headers.get("x-nonce");

  if (!client || !nonce) {
    return NextResponse.json(
      { error: "Unauthorized: Missing API Client or Nonce" },
      { status: 401 },
    );
  }

  const isNonceUnique = await NonceService.validateNonce(client.apiKey, nonce);
  if (!isNonceUnique) {
    return NextResponse.json(
      { error: "Unauthorized: Replay attack detected or duplicate nonce" },
      { status: 401 },
    );
  }

  return await next();
}
