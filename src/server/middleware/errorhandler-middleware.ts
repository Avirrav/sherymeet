import { NextResponse } from "next/server";
import { AuthenticatedRequest } from "../types/auth.types";
import { logger } from "../utils/logger";

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

  logger.error(
    `Unhandled API Error - Status ${status}: ${message}`,
    err,
    { requestId: req.requestId }
  );

  return NextResponse.json({ error: message }, { status });
}
