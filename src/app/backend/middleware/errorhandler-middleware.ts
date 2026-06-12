import { NextResponse } from "next/server";
import { AuthenticatedRequest } from "../types/auth-types";

export interface ApiError extends Error {
  status?: number;
}

/**
 * Global API error handler middleware.
 * Formats caught exceptions into structured JSON responses.
 */
export async function errorHandlerMiddleware(
  req: AuthenticatedRequest,
  err: ApiError,
): Promise<Response> {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  console.error(
    `[Error] Request ${req.requestId || "unknown"} - Status ${status}: ${message}`,
    err,
  );

  return NextResponse.json({ error: message }, { status });
}
