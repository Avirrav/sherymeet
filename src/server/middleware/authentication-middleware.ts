import { NextResponse } from "next/server";
import { AuthenticatedRequest, NextMiddleware } from "../types/auth.types";
import { ApiClientService } from "../services/auth/api-client";
import { SignatureService } from "../services/auth/signature";
import { logger } from "../utils/logger";

/**
 * Enterprise Authentication Middleware.
 * Secures routes using HMAC-SHA256 signature validation.
 */
export async function authenticationMiddleware(
  request: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  const headers = request.headers;

  // 1. Validate required headers
  const apiKey = headers.get("x-api-key");
  const timestampStr = headers.get("x-timestamp");
  const nonce = headers.get("x-nonce");
  const signature = headers.get("x-signature");
  const sigVersion = headers.get("x-signature-version");
  const requestId = request.requestId; // already injected

  if (
    !apiKey ||
    !timestampStr ||
    !nonce ||
    !signature ||
    !sigVersion ||
    !requestId
  ) {
    return NextResponse.json(
      { error: "Missing required authentication headers" },
      { status: 400 },
    );
  }

  // 2. Validate HTTPS
  const isLocalhost =
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";
  const proto =
    headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "");
  if (proto !== "https" && !isLocalhost) {
    return NextResponse.json({ error: "HTTPS is required" }, { status: 403 });
  }

  // 3. Lookup API Client
  const client = await ApiClientService.getClientByApiKey(apiKey);
  if (!client || client.revoked || client.status !== "active") {
    return NextResponse.json(
      { error: "Invalid, suspended, or revoked API Key" },
      { status: 401 },
    );
  }
  // 4. Validate Timestamp Drift (5 minutes drift allowed)
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return NextResponse.json(
      { error: "Invalid timestamp format" },
      { status: 400 },
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return NextResponse.json(
      { error: "Request timestamp expired (drift limit exceeded)" },
      { status: 401 },
    );
  }

  const origin =
    headers.get("origin") || headers.get("referer") || request.nextUrl.origin;
  if (client.allowedDomains && client.allowedDomains.length > 0 && origin) {
    let originUrl: URL;
    try {
      originUrl = new URL(origin);
    } catch {
      originUrl = new URL(`http://${origin}`);
    }
    const domainMatch = client.allowedDomains.some((domain) => {
      try {
        const allowedUrl = new URL(domain.startsWith("http") ? domain : `http://${domain}`);
        const isOriginLocal = originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
        const isAllowedLocal = allowedUrl.hostname === "localhost" || allowedUrl.hostname === "127.0.0.1";
        if (isOriginLocal || isAllowedLocal) {
          return allowedUrl.hostname === originUrl.hostname;
        }
        return allowedUrl.host === originUrl.host;
      } catch {
        const domainHostname = domain.replace(/^(https?:\/\/)?/, "").split(":")[0];
        const isOriginLocal = originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
        const isAllowedLocal = domainHostname === "localhost" || domainHostname === "127.0.0.1";
        if (isOriginLocal || isAllowedLocal) {
          return domainHostname === originUrl.hostname;
        }
        return domainHostname === originUrl.hostname;
      }
    });
    if (!domainMatch) {
      return NextResponse.json(
        { error: "Origin domain not allowed" },
        { status: 403 },
      );
    }
  }

  // 6. Capture Raw Body for verification
  let rawBody: Buffer = Buffer.from("");
  try {
    const clone = request.clone();
    const bodyText = await clone.text();
    rawBody = Buffer.from(bodyText, "utf8");
  } catch (err) {
    logger.error("Failed to parse request raw body for authentication", err, {
      requestId,
    });
  }
  request.rawBody = rawBody;

  // 7. Verify Signature (checks current & previous secret versions)
  const host = headers.get("host") || request.nextUrl.host;
  const path = request.nextUrl.pathname;
  const query = request.nextUrl.search;

  const { verified } = await SignatureService.verifySignature({
    method: request.method,
    host,
    path,
    query,
    timestamp: timestampStr,
    nonce,
    body: rawBody,
    origin: origin || undefined,
    signature,
    client,
  });

  if (!verified) {
    return NextResponse.json(
      { error: "Invalid signature matching failed" },
      { status: 401 },
    );
  }
  // Attach client to request context
  request.client = client;
  return await next();
}
