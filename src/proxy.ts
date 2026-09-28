import { NextRequest, NextResponse } from "next/server";
import { config as appConfig } from "@/server/utils/config";

function forbidden(reason: string): NextResponse {
  return NextResponse.json({ error: `Forbidden: ${reason}` }, { status: 403 });
}

export function proxy(request: NextRequest) {
  // In development, skip all origin checks to allow egress testing from external domains
  if (appConfig.NODE_ENV === "development") {
    return NextResponse.next();
  }
  // Fetch sec-fetch-site header to determine the request's origin context
  const secFetchSite = request.headers.get("sec-fetch-site");

  // Build allowed origins list (main app)
  const allowedOrigins = [new URL(appConfig.NEXT_PUBLIC_API_URL).origin];
  if (appConfig.RECORDING_BASE_URL) {
    try {
      const recordingOrigin = new URL(appConfig.RECORDING_BASE_URL).origin;
      if (!allowedOrigins.includes(recordingOrigin)) {
        allowedOrigins.push(recordingOrigin);
      }
    } catch {
      // Invalid RECORDING_BASE_URL, ignore
    }
  }

  // Add the webhooks origin if configured
  if (appConfig.LIVEKIT_WEBHOOKS_URL) {
    try {
      const webhooksOrigin = new URL(appConfig.LIVEKIT_WEBHOOKS_URL).origin;
      if (!allowedOrigins.includes(webhooksOrigin)) {
        allowedOrigins.push(webhooksOrigin);
      }
    } catch {
      // Invalid NEXT_PUBLIC_API_URL, ignore
    }
  }

  // Get the origin and referer headers from the request to determine the request's provenance
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Check if request is from an allowed origin
  let refererOrigin: string | null = null;
  if (referer && URL.canParse(referer)) {
    refererOrigin = new URL(referer).origin;
  }
  const requestOrigin = origin || refererOrigin;
  const isAllowedOrigin = requestOrigin && allowedOrigins.includes(requestOrigin);

  // For cross-origin requests, only allow if from recording origin or  webhooks origin
  if (secFetchSite && secFetchSite !== "same-origin" && !isAllowedOrigin) {
    return forbidden("cross-origin requests are not allowed");
  }

  // Validate the origin and referer headers against the allowed origins list
  if (origin) {
    try {
      if (!allowedOrigins.includes(new URL(origin).origin)) {
        return forbidden("origin mismatch");
      }
    } catch {
      return forbidden("invalid origin header");
    }
  } else if (referer) {
    try {
      if (!allowedOrigins.includes(new URL(referer).origin)) {
        return forbidden("referer mismatch");
      }
    } catch {
      return forbidden("invalid referer header");
    }
  } else if (!secFetchSite) {
    return forbidden("missing request provenance headers");
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/server/:path*",
};
