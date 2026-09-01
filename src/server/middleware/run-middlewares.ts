import { NextRequest } from "next/server";
import { AppMiddleware, AuthenticatedRequest } from "../types/auth.types";
import { errorHandlerMiddleware } from "./errorhandler-middleware";

/**
 * Higher-order runner that sequences an array of AppMiddleware functions,
 * catching any exceptions and routing them to the global error handler.
 */
export function runMiddlewares(
  middlewares: AppMiddleware[],
  handler: (request: AuthenticatedRequest) => Promise<Response>,
) {
  return async (request: NextRequest): Promise<Response> => {
    const authRequest = request as AuthenticatedRequest;
    let index = 0;
    const next = async (): Promise<Response> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        return await middleware(authRequest, next);
      }
      return await handler(authRequest);
    };

    try {
      return await next();
    } catch (err) {
      return await errorHandlerMiddleware(authRequest, err as Error);
    }
  };
}
