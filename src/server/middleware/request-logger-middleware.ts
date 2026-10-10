import { AuthenticatedRequest, NextMiddleware } from "../types/auth.types";
import { logger } from "../utils/logger";

/**
 * Logs incoming API requests with method, path, and response status.
 * Should be placed early in the middleware chain (after requestIdMiddleware).
 */
export async function requestLoggerMiddleware(
  request: AuthenticatedRequest,
  next: NextMiddleware,
): Promise<Response> {
  const startTime = Date.now();
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;

  logger.info(`--> ${method} ${path}`, { requestId: request.requestId });

  const response = await next();

  const duration = Date.now() - startTime;
  const status = response.status;

  logger.info(`<-- ${method} ${path} ${status} ${duration}ms`, {
    requestId: request.requestId,
  });

  return response;
}
