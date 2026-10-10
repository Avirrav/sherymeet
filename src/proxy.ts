import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const method = request.method;
  const path = request.nextUrl.pathname;
  const timestamp = new Date().toISOString();

  // Log incoming API request
  const logEntry = {
    timestamp,
    level: "info",
    message: `${method} ${path}`,
    type: "api_request",
  };

  // JSON format for production log aggregators
  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(logEntry));
  } else {
    console.log(`${timestamp} [API] ${method} ${path}`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
