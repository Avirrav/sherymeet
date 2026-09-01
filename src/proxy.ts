import { NextRequest, NextResponse } from "next/server";
import { config as appConfig } from "@/server/utils/config";

/**
 * Centralized gate for the browser-facing /api/server/* routes (Next.js 16
 * proxy, formerly middleware). Standard layered defense:
 *
 *  1. Fetch metadata (Sec-Fetch-Site) — sent by every modern browser and not
 *     settable from JavaScript, so a request coming from another website can
 *     never look same-origin. This is the OWASP-recommended CSRF layer.
 *  2. Origin/Referer allowlist — must match NEXT_PUBLIC_API_URL when present;
 *     requests with no browser provenance headers at all are rejected.
 *
 * Headers can always be forged by non-browser clients, so these layers only
 * filter traffic. Real authentication is the signed LiveKit room token that
 * every /api/server/* handler verifies server-side.
 */

function forbidden(reason: string): NextResponse {
  return NextResponse.json({ error: `Forbidden: ${reason}` }, { status: 403 });
}

export function proxy(request: NextRequest) {
  // Layer 1: fetch metadata. Browsers always send this; anything other than
  // a same-origin call is rejected outright.
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin") {
    return forbidden("cross-origin requests are not allowed");
  }

  // Layer 2: Origin/Referer allowlist.
  const allowedOrigin = appConfig.NEXT_PUBLIC_API_URL;
  if (!allowedOrigin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(allowedOrigin).origin;
  } catch {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) {
    try {
      if (new URL(origin).origin !== expectedOrigin) {
        return forbidden("origin mismatch");
      }
    } catch {
      return forbidden("invalid origin header");
    }
  } else if (referer) {
    try {
      if (new URL(referer).origin !== expectedOrigin) {
        return forbidden("referer mismatch");
      }
    } catch {
      return forbidden("invalid referer header");
    }
  } else if (!secFetchSite) {
    // No fetch metadata and no provenance headers: not a browser call from
    // our app. Same-origin browser requests always carry at least one of
    // these (Referrer-Policy is same-origin, so Referer is sent).
    return forbidden("missing request provenance headers");
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/server/:path*",
};
